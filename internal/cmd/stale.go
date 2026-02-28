package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"
	"time"

	"github.com/eytanlevit/north/internal/store"
	"github.com/spf13/cobra"
)

func NewStaleCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "stale",
		Short: "List issues not updated recently",
		Long:  "Show issues that haven't been updated in the specified number of days.",
		Args:  cobra.NoArgs,
		RunE:  runStale,
	}
	cmd.Flags().IntP("days", "d", 7, "Number of days to consider stale")
	cmd.Flags().Bool("json", false, "Output as JSON")
	return cmd
}

type staleIssue struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Status    string `json:"status"`
	Updated   string `json:"updated"`
	DaysStale int    `json:"days_stale"`
}

func runStale(cmd *cobra.Command, args []string) error {
	days, _ := cmd.Flags().GetInt("days")
	jsonOut, _ := cmd.Flags().GetBool("json")

	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	root, err := store.FindProjectRoot(cwd)
	if err != nil {
		return err
	}
	s := store.NewFileStore(root)

	issues, err := s.ListIssues()
	if err != nil {
		return err
	}

	now := time.Now()
	cutoff := now.AddDate(0, 0, -days)
	var stale []staleIssue

	for _, issue := range issues {
		updated, err := time.Parse("2006-01-02", issue.Meta.Updated)
		if err != nil {
			continue
		}
		if updated.Before(cutoff) {
			daysSince := int(now.Sub(updated).Hours() / 24)
			stale = append(stale, staleIssue{
				ID:        issue.Meta.ID,
				Title:     issue.Meta.Title,
				Status:    issue.Meta.Status,
				Updated:   issue.Meta.Updated,
				DaysStale: daysSince,
			})
		}
	}

	if jsonOut {
		if stale == nil {
			stale = []staleIssue{}
		}
		return json.NewEncoder(cmd.OutOrStdout()).Encode(stale)
	}

	if len(stale) == 0 {
		fmt.Fprintln(cmd.OutOrStdout(), "No stale issues found.")
		return nil
	}

	w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 4, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tTITLE\tSTATUS\tUPDATED\tDAYS STALE")
	for _, s := range stale {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%d\n", s.ID, s.Title, s.Status, s.Updated, s.DaysStale)
	}
	return w.Flush()
}

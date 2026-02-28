package cmd

import (
	"os"

	"github.com/eytanlevit/north/internal/model"
	"github.com/eytanlevit/north/internal/render"
	"github.com/eytanlevit/north/internal/store"
	"github.com/spf13/cobra"
)

func NewListCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all issues",
		Args:  cobra.NoArgs,
		RunE:  runList,
	}
	cmd.Flags().String("status", "", "Filter by status")
	cmd.Flags().Bool("json", false, "Output as JSON")
	return cmd
}

func runList(cmd *cobra.Command, args []string) error {
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

	statusFilter, _ := cmd.Flags().GetString("status")
	if statusFilter != "" {
		var filtered []*model.Issue
		for _, issue := range issues {
			if issue.Meta.Status == statusFilter {
				filtered = append(filtered, issue)
			}
		}
		if filtered == nil {
			filtered = []*model.Issue{}
		}
		issues = filtered
	}

	jsonOutput, _ := cmd.Flags().GetBool("json")
	if jsonOutput {
		return render.JSON(cmd.OutOrStdout(), issues)
	}

	render.IssueTable(cmd.OutOrStdout(), issues)
	return nil
}

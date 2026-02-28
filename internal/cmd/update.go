package cmd

import (
	"fmt"
	"os"
	"time"

	"github.com/eytanlevit/north/internal/model"
	"github.com/eytanlevit/north/internal/store"
	"github.com/spf13/cobra"
)

func NewUpdateCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "update <issue-id>",
		Short: "Update an issue's metadata",
		Args:  cobra.ExactArgs(1),
		RunE:  runUpdate,
	}
	cmd.Flags().String("status", "", "Set status")
	cmd.Flags().String("priority", "", "Set priority")
	cmd.Flags().StringSlice("labels", nil, "Set labels")
	cmd.Flags().String("title", "", "Set title")
	cmd.Flags().String("parent", "", "Set parent issue ID")
	cmd.Flags().StringSlice("blocked-by", nil, "Set blocked-by issue IDs")
	return cmd
}

func runUpdate(cmd *cobra.Command, args []string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	root, err := store.FindProjectRoot(cwd)
	if err != nil {
		return err
	}
	s := store.NewFileStore(root)

	issue, err := s.LoadIssue(args[0])
	if err != nil {
		return err
	}

	changed := false

	if cmd.Flags().Changed("status") {
		v, _ := cmd.Flags().GetString("status")
		issue.Meta.Status = v
		changed = true
	}
	if cmd.Flags().Changed("priority") {
		v, _ := cmd.Flags().GetString("priority")
		issue.Meta.Priority = v
		changed = true
	}
	if cmd.Flags().Changed("labels") {
		v, _ := cmd.Flags().GetStringSlice("labels")
		issue.Meta.Labels = v
		changed = true
	}
	if cmd.Flags().Changed("title") {
		v, _ := cmd.Flags().GetString("title")
		issue.Meta.Title = v
		changed = true
	}
	if cmd.Flags().Changed("parent") {
		v, _ := cmd.Flags().GetString("parent")
		issue.Meta.Parent = v
		changed = true
	}
	if cmd.Flags().Changed("blocked-by") {
		v, _ := cmd.Flags().GetStringSlice("blocked-by")
		issue.Meta.BlockedBy = v
		changed = true
	}

	if !changed {
		return fmt.Errorf("no update flags provided")
	}

	// Validate against config
	cfg, err := s.LoadConfig()
	if err != nil {
		return err
	}
	if err := model.ValidateIssue(issue, cfg); err != nil {
		return err
	}

	issue.Meta.Updated = time.Now().Format("2006-01-02")

	if err := s.SaveIssue(issue); err != nil {
		return err
	}

	fmt.Fprintf(cmd.OutOrStdout(), "Updated %s\n", issue.Meta.ID)
	return nil
}

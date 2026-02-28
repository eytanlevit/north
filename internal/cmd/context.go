package cmd

import (
	"os"

	"github.com/eytanlevit/north/internal/render"
	"github.com/eytanlevit/north/internal/store"
	"github.com/spf13/cobra"
)

func NewContextCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "context <issue-id>",
		Short: "Get full context for an issue",
		Args:  cobra.ExactArgs(1),
		RunE:  runContext,
	}
	cmd.Flags().Bool("json", false, "Output as JSON")
	return cmd
}

func runContext(cmd *cobra.Command, args []string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	root, err := store.FindProjectRoot(cwd)
	if err != nil {
		return err
	}
	s := store.NewFileStore(root)

	cfg, err := s.LoadConfig()
	if err != nil {
		return err
	}

	issue, err := s.LoadIssue(args[0])
	if err != nil {
		return err
	}

	data := &render.ContextData{
		Project: cfg,
		Issue:   issue,
	}

	// Load blocking issues
	for _, blockerID := range issue.Meta.BlockedBy {
		blocker, err := s.LoadIssue(blockerID)
		if err != nil {
			continue // Skip missing blockers
		}
		data.BlockingIssues = append(data.BlockingIssues, blocker)
	}

	// Load parent issue
	if issue.Meta.Parent != "" {
		parent, err := s.LoadIssue(issue.Meta.Parent)
		if err == nil {
			data.ParentIssue = parent
		}
	}

	// Load documents
	data.Documents = render.LoadDocuments(issue, root)

	jsonOutput, _ := cmd.Flags().GetBool("json")
	if jsonOutput {
		return render.JSON(cmd.OutOrStdout(), data)
	}

	render.ContextMarkdown(cmd.OutOrStdout(), data, root)
	return nil
}

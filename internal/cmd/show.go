package cmd

import (
	"os"

	"github.com/eytanlevit/north/internal/render"
	"github.com/eytanlevit/north/internal/store"
	"github.com/spf13/cobra"
)

func NewShowCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "show <issue-id>",
		Short: "Show issue details",
		Args:  cobra.ExactArgs(1),
		RunE:  runShow,
	}
	cmd.Flags().Bool("json", false, "Output as JSON")
	return cmd
}

func runShow(cmd *cobra.Command, args []string) error {
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

	jsonOutput, _ := cmd.Flags().GetBool("json")
	if jsonOutput {
		return render.JSON(cmd.OutOrStdout(), issue)
	}

	render.IssueDetail(cmd.OutOrStdout(), issue)
	return nil
}

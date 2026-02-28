package cmd

import (
	"os"

	"github.com/eytanlevit/north/internal/session"
	"github.com/eytanlevit/north/internal/store"
	"github.com/eytanlevit/north/internal/tui"
	"github.com/spf13/cobra"
)

func NewSessionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "session [issue-id]",
		Short: "Launch agent session with chat and kanban board",
		Long: `Launch an integrated TUI with Claude Code chat on the left
and the kanban board on the right. Optionally provide an issue ID
to pre-load context into the agent prompt.`,
		Args: cobra.MaximumNArgs(1),
		RunE: runSession,
	}
}

func runSession(cmd *cobra.Command, args []string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	root, err := store.FindProjectRoot(cwd)
	if err != nil {
		return err
	}

	var issueID string
	if len(args) > 0 {
		issueID = args[0]
	}

	s := store.NewFileStore(root)
	contextStr, err := session.BuildContext(s, issueID)
	if err != nil {
		return err
	}

	// Default prompt if no issue context
	prompt := contextStr
	if prompt == "" {
		prompt = "You are working in a project managed by North. Use `north list` to see current issues."
	}

	return tui.RunSession(s, prompt)
}

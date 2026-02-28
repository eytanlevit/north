package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"

	"github.com/eytanlevit/north/internal/session"
	"github.com/eytanlevit/north/internal/store"
	"github.com/spf13/cobra"
)

func NewSessionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "session [issue-id]",
		Short: "Launch tmux split with Claude Code and TUI",
		Long: `Launch a tmux session with Claude Code on the left and the
north TUI kanban board on the right. Optionally provide an issue ID
to pre-load context into Claude Code.`,
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

	// Build context if issue ID provided
	s := store.NewFileStore(root)
	contextStr, err := session.BuildContext(s, issueID)
	if err != nil {
		return err
	}

	// Build left pane command
	leftCmd := "claude"
	if contextStr != "" {
		leftCmd = fmt.Sprintf("claude %q", contextStr)
	}

	ts := session.TmuxSession{
		Name:     session.SessionName(issueID),
		WorkDir:  root,
		LeftCmd:  leftCmd,
		RightCmd: "north tui",
	}

	// Validate tmux is available
	if err := ts.Validate(exec.LookPath); err != nil {
		return err
	}

	// Exec into tmux (replaces current process)
	tmuxPath, _ := exec.LookPath("tmux")
	tmuxArgs := append([]string{"tmux"}, ts.Args()...)
	return syscall.Exec(tmuxPath, tmuxArgs, os.Environ())
}

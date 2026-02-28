package cmd

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/eytanlevit/north/internal/model"
	"github.com/eytanlevit/north/internal/store"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

func NewEditCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "edit <issue-id>",
		Short: "Edit an issue in $EDITOR",
		Args:  cobra.ExactArgs(1),
		RunE:  runEdit,
	}
}

func runEdit(cmd *cobra.Command, args []string) error {
	editor := os.Getenv("EDITOR")
	if editor == "" {
		return fmt.Errorf("$EDITOR is not set")
	}

	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return fmt.Errorf("stdin is not a terminal")
	}

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

	// Write issue to temp file
	data, err := model.SerializeIssue(issue)
	if err != nil {
		return err
	}

	tmpFile, err := os.CreateTemp("", "north-edit-*.md")
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.Write(data); err != nil {
		tmpFile.Close()
		return fmt.Errorf("write temp file: %w", err)
	}
	tmpFile.Close()

	// Open editor
	editorCmd := exec.Command(editor, tmpPath)
	editorCmd.Stdin = os.Stdin
	editorCmd.Stdout = os.Stdout
	editorCmd.Stderr = os.Stderr
	if err := editorCmd.Run(); err != nil {
		return fmt.Errorf("editor failed: %w", err)
	}

	// Re-read and parse
	edited, err := os.ReadFile(tmpPath)
	if err != nil {
		return fmt.Errorf("read edited file: %w", err)
	}

	newIssue, err := model.ParseIssue(edited)
	if err != nil {
		return fmt.Errorf("parse edited issue: %w", err)
	}

	// Validate
	cfg, err := s.LoadConfig()
	if err != nil {
		return err
	}
	if err := model.ValidateIssue(newIssue, cfg); err != nil {
		return err
	}

	// Preserve the original ID
	newIssue.Meta.ID = issue.Meta.ID

	if err := s.SaveIssue(newIssue); err != nil {
		return err
	}

	fmt.Fprintf(cmd.OutOrStdout(), "Updated %s\n", issue.Meta.ID)
	return nil
}

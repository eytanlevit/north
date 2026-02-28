package cmd

import (
	"os"

	"github.com/eytanlevit/north/internal/store"
	"github.com/eytanlevit/north/internal/tui"
	"github.com/spf13/cobra"
)

func NewTUICmd() *cobra.Command {
	return &cobra.Command{
		Use:   "tui",
		Short: "Open interactive kanban board",
		Args:  cobra.NoArgs,
		RunE:  runTUI,
	}
}

func runTUI(cmd *cobra.Command, args []string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	root, err := store.FindProjectRoot(cwd)
	if err != nil {
		return err
	}
	s := store.NewFileStore(root)
	return tui.Run(s)
}

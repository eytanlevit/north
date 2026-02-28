package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/eytanlevit/north/internal/model"
	"github.com/eytanlevit/north/internal/store"
	"github.com/spf13/cobra"
)

var claudeMDTemplate = "# North Project\n\n" +
	"This project uses North for issue tracking. Issues are stored in `.north/issues/`.\n\n" +
	"## Commands\n\n" +
	"- `north create \"Title\"` — Create a new issue\n" +
	"- `north list` — List all issues\n" +
	"- `north show NOR-1` — Show issue details\n" +
	"- `north update NOR-1 --status done` — Update an issue\n" +
	"- `north comment NOR-1 \"message\"` — Add a comment\n" +
	"- `north context NOR-1` — Get full context for an issue\n"

func NewInitCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "init",
		Short: "Initialize a new North project",
		Args:  cobra.NoArgs,
		RunE:  runInit,
	}
}

func runInit(cmd *cobra.Command, args []string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("get working directory: %w", err)
	}

	northDir := filepath.Join(cwd, ".north")

	// Fail if .north/ already exists
	if _, err := os.Stat(northDir); err == nil {
		return model.ErrProjectExists
	}

	// Create directory structure
	dirs := []string{
		northDir,
		filepath.Join(northDir, "issues"),
		filepath.Join(northDir, "docs"),
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0755); err != nil {
			return fmt.Errorf("create directory %s: %w", d, err)
		}
	}

	// Write default config
	projectName := filepath.Base(cwd)
	cfg := model.DefaultConfig(projectName)
	cfgData, err := model.SerializeConfig(&cfg)
	if err != nil {
		return err
	}
	if err := store.AtomicWriteFile(filepath.Join(northDir, "config.yaml"), cfgData, 0644); err != nil {
		return err
	}

	// Write CLAUDE.md template
	if err := store.AtomicWriteFile(filepath.Join(northDir, "CLAUDE.md"), []byte(claudeMDTemplate), 0644); err != nil {
		return err
	}

	fmt.Fprintf(cmd.OutOrStdout(), "Initialized North project in %s\n", cwd)
	return nil
}

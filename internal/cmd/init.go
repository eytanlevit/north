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
	"This project uses North for issue tracking. Issues are markdown files in `.north/issues/`.\n\n" +
	"## Commands\n\n" +
	"### Reading\n" +
	"- `north list [--status X] [--json]` — List issues (filter by status)\n" +
	"- `north show NOR-1 [--json]` — Show full issue details\n" +
	"- `north context NOR-1 [--json]` — Get complete context (issue + related + docs)\n" +
	"- `north stale [--days N] [--json]` — Find issues not updated in N days\n\n" +
	"### Writing\n" +
	"- `north create \"Title\" [--status X] [--priority X] [--label X]` — Create issue\n" +
	"- `north update NOR-1 --status done` — Update issue fields\n" +
	"- `north comment NOR-1 \"message\"` — Add a comment\n" +
	"- `north edit NOR-1` — Open issue in $EDITOR\n\n" +
	"### Interactive\n" +
	"- `north tui` — Open kanban board\n" +
	"- `north session [NOR-1]` — Launch agent chat + kanban board\n\n" +
	"## Workflow\n\n" +
	"1. Check context before starting: `north context NOR-1`\n" +
	"2. Set status to in-progress: `north update NOR-1 --status in-progress`\n" +
	"3. Do the work, commit with issue ID in message: `git commit -m \"NOR-1: description\"`\n" +
	"4. Add a comment summarizing changes: `north comment NOR-1 \"Done: implemented X\"`\n" +
	"5. Mark done: `north update NOR-1 --status done`\n\n" +
	"## Tips\n\n" +
	"- Use `--json` on read commands for structured output\n" +
	"- Check blocked issues: `north list --json` and inspect `blocked_by` fields\n" +
	"- Find stale work: `north stale --days 3`\n"

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

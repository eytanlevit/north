package cmd

import (
	"embed"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

//go:embed skill_data/north.md
var skillFS embed.FS

func NewSkillCmd() *cobra.Command {
	skill := &cobra.Command{
		Use:   "skill",
		Short: "Manage Claude Code skills",
	}

	install := &cobra.Command{
		Use:   "install",
		Short: "Install North skill for Claude Code",
		Args:  cobra.NoArgs,
		RunE:  runSkillInstall,
	}

	skill.AddCommand(install)
	return skill
}

func runSkillInstall(cmd *cobra.Command, args []string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("get home directory: %w", err)
	}

	skillDir := filepath.Join(home, ".claude", "skills")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		return fmt.Errorf("create skills directory: %w", err)
	}

	data, err := skillFS.ReadFile("skill_data/north.md")
	if err != nil {
		return fmt.Errorf("read embedded skill: %w", err)
	}

	dest := filepath.Join(skillDir, "north.md")
	if err := os.WriteFile(dest, data, 0644); err != nil {
		return fmt.Errorf("write skill file: %w", err)
	}

	fmt.Fprintf(cmd.OutOrStdout(), "Installed North skill to %s\n", dest)
	return nil
}

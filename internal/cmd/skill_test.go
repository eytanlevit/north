package cmd

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSkillInstall(t *testing.T) {
	// Use temp dir as HOME
	tmpHome := t.TempDir()
	origHome := os.Getenv("HOME")
	t.Setenv("HOME", tmpHome)
	defer os.Setenv("HOME", origHome)

	root := &cobra.Command{Use: "north"}
	root.AddCommand(NewSkillCmd())

	buf := new(bytes.Buffer)
	root.SetOut(buf)
	root.SetArgs([]string{"skill", "install"})

	err := root.Execute()
	require.NoError(t, err)

	// Verify file was written
	dest := filepath.Join(tmpHome, ".claude", "skills", "north.md")
	data, err := os.ReadFile(dest)
	require.NoError(t, err)
	assert.Contains(t, string(data), "North")
	assert.Contains(t, string(data), "north list")
	assert.Contains(t, buf.String(), "Installed North skill")
}

func TestSkillInstall_CreatesDir(t *testing.T) {
	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)

	root := &cobra.Command{Use: "north"}
	root.AddCommand(NewSkillCmd())

	buf := new(bytes.Buffer)
	root.SetOut(buf)
	root.SetArgs([]string{"skill", "install"})

	err := root.Execute()
	require.NoError(t, err)

	// Dir should have been created
	_, err = os.Stat(filepath.Join(tmpHome, ".claude", "skills"))
	assert.NoError(t, err)
}

func TestSkillEmbed(t *testing.T) {
	// Verify the embedded skill file is accessible
	data, err := skillFS.ReadFile("skill_data/north.md")
	require.NoError(t, err)
	assert.Contains(t, string(data), "North")
}

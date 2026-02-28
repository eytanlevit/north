package cmd

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/eytanlevit/north/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInitCmd_CreatesProject(t *testing.T) {
	dir := t.TempDir()
	chdir(t, dir)

	cmd := NewInitCmd()
	cmd.SetArgs([]string{})
	require.NoError(t, cmd.Execute())

	// Verify directory structure
	assert.DirExists(t, filepath.Join(dir, ".north"))
	assert.DirExists(t, filepath.Join(dir, ".north", "issues"))
	assert.DirExists(t, filepath.Join(dir, ".north", "docs"))
	assert.FileExists(t, filepath.Join(dir, ".north", "config.yaml"))
	assert.FileExists(t, filepath.Join(dir, ".north", "CLAUDE.md"))

	// Verify config content
	data, err := os.ReadFile(filepath.Join(dir, ".north", "config.yaml"))
	require.NoError(t, err)
	cfg, err := model.ParseConfig(data)
	require.NoError(t, err)
	assert.Equal(t, filepath.Base(dir), cfg.Project)
	assert.Equal(t, "NOR", cfg.Prefix)
}

func TestInitCmd_FailsIfExists(t *testing.T) {
	dir := t.TempDir()
	chdir(t, dir)
	require.NoError(t, os.MkdirAll(filepath.Join(dir, ".north"), 0755))

	cmd := NewInitCmd()
	cmd.SetArgs([]string{})
	err := cmd.Execute()
	assert.ErrorIs(t, err, model.ErrProjectExists)
}

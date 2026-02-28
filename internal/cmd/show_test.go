package cmd

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/eytanlevit/north/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShowCmd_Detail(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "My Issue", "todo", "high")

	var buf bytes.Buffer
	cmd := NewShowCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"NOR-1"})
	require.NoError(t, cmd.Execute())

	out := buf.String()
	assert.Contains(t, out, "NOR-1")
	assert.Contains(t, out, "My Issue")
	assert.Contains(t, out, "todo")
	assert.Contains(t, out, "high")
}

func TestShowCmd_JSON(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "JSON Issue", "todo", "medium")

	var buf bytes.Buffer
	cmd := NewShowCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"NOR-1", "--json"})
	require.NoError(t, cmd.Execute())

	var result map[string]any
	require.NoError(t, json.Unmarshal(buf.Bytes(), &result))
	meta := result["meta"].(map[string]any)
	assert.Equal(t, "NOR-1", meta["id"])
}

func TestShowCmd_NotFound(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)

	cmd := NewShowCmd()
	cmd.SetArgs([]string{"NOR-999"})
	err := cmd.Execute()
	assert.ErrorIs(t, err, model.ErrIssueNotFound)
}

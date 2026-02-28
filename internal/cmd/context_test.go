package cmd

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/eytanlevit/north/internal/model"
	"github.com/eytanlevit/north/internal/render"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupContextProject(t *testing.T) string {
	t.Helper()
	dir := setupProject(t)

	// Create parent issue NOR-1
	parent := &model.Issue{
		Meta: model.IssueMeta{
			FormatVersion: 1,
			ID:            "NOR-1",
			Title:         "Core infrastructure",
			Status:        "in-progress",
			Priority:      "high",
			Created:       "2026-02-28",
			Updated:       "2026-02-28",
		},
	}
	writeFullIssue(t, dir, parent)

	// Create blocking issue NOR-2
	blocker := &model.Issue{
		Meta: model.IssueMeta{
			FormatVersion: 1,
			ID:            "NOR-2",
			Title:         "Set up database schema",
			Status:        "in-progress",
			Priority:      "high",
			Created:       "2026-02-28",
			Updated:       "2026-02-28",
		},
	}
	writeFullIssue(t, dir, blocker)

	// Create main issue NOR-3 with all fields
	main := &model.Issue{
		Meta: model.IssueMeta{
			FormatVersion: 1,
			ID:            "NOR-3",
			Title:         "Implement user authentication",
			Status:        "in-progress",
			Priority:      "high",
			Labels:        []string{"auth", "backend"},
			Parent:        "NOR-1",
			BlockedBy:     []string{"NOR-2"},
			Docs:          []string{"docs/prd.md"},
			Created:       "2026-02-28",
			Updated:       "2026-02-28",
			Comments: []model.Comment{
				{Author: "claude-code", Date: "2026-02-28", Body: "Started work on this."},
				{Author: "eytan", Date: "2026-02-28", Body: "Use RS256 instead of HS256."},
			},
		},
		Body: "\n## Description\n\nImplement JWT-based authentication for the API.\n",
	}
	writeFullIssue(t, dir, main)

	// Create linked document
	require.NoError(t, os.WriteFile(
		filepath.Join(dir, ".north", "docs", "prd.md"),
		[]byte("# PRD\n\nProduct requirements document.\n"),
		0644,
	))

	return dir
}

func writeFullIssue(t *testing.T, dir string, issue *model.Issue) {
	t.Helper()
	data, err := model.SerializeIssue(issue)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(
		filepath.Join(dir, ".north", "issues", issue.Meta.ID+".md"),
		data, 0644,
	))
}

func TestContextCmd_Markdown(t *testing.T) {
	dir := setupContextProject(t)
	chdir(t, dir)

	var buf bytes.Buffer
	cmd := NewContextCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"NOR-3"})
	require.NoError(t, cmd.Execute())

	out := buf.String()

	// Project section
	assert.Contains(t, out, "# Project: test")

	// Issue section
	assert.Contains(t, out, "# Issue: NOR-3 — Implement user authentication")
	assert.Contains(t, out, "Status: in-progress | Priority: high | Labels: auth, backend")

	// Body
	assert.Contains(t, out, "## Description")
	assert.Contains(t, out, "Implement JWT-based authentication")

	// Comments
	assert.Contains(t, out, "## Comments (2)")
	assert.Contains(t, out, "[2026-02-28 claude-code] Started work on this.")
	assert.Contains(t, out, "[2026-02-28 eytan] Use RS256 instead of HS256.")

	// Blocking issues
	assert.Contains(t, out, "# Blocking Issues")
	assert.Contains(t, out, "NOR-2 — Set up database schema")

	// Parent issue
	assert.Contains(t, out, "# Related Issues (parent)")
	assert.Contains(t, out, "NOR-1 — Core infrastructure")

	// Documents
	assert.Contains(t, out, "# Documents")
	assert.Contains(t, out, "docs/prd.md")
	assert.Contains(t, out, "Product requirements document.")
}

func TestContextCmd_GoldenFile(t *testing.T) {
	projectRoot := findProjectRoot(t) // capture before chdir
	dir := setupContextProject(t)
	chdir(t, dir)

	var buf bytes.Buffer
	cmd := NewContextCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"NOR-3"})
	require.NoError(t, cmd.Execute())

	got := buf.String()
	goldenPath := filepath.Join(projectRoot, "testdata", "golden", "context_full.golden")

	if os.Getenv("UPDATE_GOLDEN") == "1" {
		require.NoError(t, os.MkdirAll(filepath.Dir(goldenPath), 0755))
		require.NoError(t, os.WriteFile(goldenPath, []byte(got), 0644))
		t.Log("Golden file updated")
		return
	}

	expected, err := os.ReadFile(goldenPath)
	if os.IsNotExist(err) {
		t.Fatalf("Golden file not found at %s. Run with UPDATE_GOLDEN=1 to create it.", goldenPath)
	}
	require.NoError(t, err)
	assert.Equal(t, string(expected), got, "Output differs from golden file. Run with UPDATE_GOLDEN=1 to update.")
}

func TestContextCmd_JSON(t *testing.T) {
	dir := setupContextProject(t)
	chdir(t, dir)

	var buf bytes.Buffer
	cmd := NewContextCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"NOR-3", "--json"})
	require.NoError(t, cmd.Execute())

	var result render.ContextData
	require.NoError(t, json.Unmarshal(buf.Bytes(), &result))

	assert.Equal(t, "test", result.Project.Project)
	assert.Equal(t, "NOR-3", result.Issue.Meta.ID)
	require.Len(t, result.BlockingIssues, 1)
	assert.Equal(t, "NOR-2", result.BlockingIssues[0].Meta.ID)
	assert.NotNil(t, result.ParentIssue)
	assert.Equal(t, "NOR-1", result.ParentIssue.Meta.ID)
	require.Len(t, result.Documents, 1)
	assert.Equal(t, "docs/prd.md", result.Documents[0].Path)
}

func TestContextCmd_Minimal(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Simple issue", "todo", "medium")

	var buf bytes.Buffer
	cmd := NewContextCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"NOR-1"})
	require.NoError(t, cmd.Execute())

	out := buf.String()
	assert.Contains(t, out, "# Issue: NOR-1 — Simple issue")
	assert.NotContains(t, out, "# Blocking Issues")
	assert.NotContains(t, out, "# Related Issues")
	assert.NotContains(t, out, "# Documents")
}

// findProjectRoot finds the project root for golden file paths.
func findProjectRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	require.NoError(t, err)
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("could not find project root (go.mod)")
		}
		dir = parent
	}
}

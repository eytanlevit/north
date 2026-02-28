package store

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/eytanlevit/north/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestProject(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	northDir := filepath.Join(dir, ".north")
	require.NoError(t, os.MkdirAll(filepath.Join(northDir, "issues"), 0755))
	require.NoError(t, os.MkdirAll(filepath.Join(northDir, "docs"), 0755))

	cfg := model.DefaultConfig("test-project")
	data, err := model.SerializeConfig(&cfg)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(northDir, "config.yaml"), data, 0644))

	return dir
}

func writeTestIssue(t *testing.T, dir string, issue *model.Issue) {
	t.Helper()
	data, err := model.SerializeIssue(issue)
	require.NoError(t, err)
	path := filepath.Join(dir, ".north", "issues", issue.Meta.ID+".md")
	require.NoError(t, os.WriteFile(path, data, 0644))
}

func testIssue(id string, num int) *model.Issue {
	return &model.Issue{
		Meta: model.IssueMeta{
			FormatVersion: 1,
			ID:            id,
			Title:         "Test issue " + id,
			Status:        "todo",
			Priority:      "medium",
			Created:       "2026-02-28",
			Updated:       "2026-02-28",
		},
		Body: "\n## Description\n\nTest body.\n",
	}
}

func TestFindProjectRoot_CurrentDir(t *testing.T) {
	dir := setupTestProject(t)
	root, err := FindProjectRoot(dir)
	require.NoError(t, err)
	assert.Equal(t, dir, root)
}

func TestFindProjectRoot_ParentDir(t *testing.T) {
	dir := setupTestProject(t)
	child := filepath.Join(dir, "sub", "deep")
	require.NoError(t, os.MkdirAll(child, 0755))

	root, err := FindProjectRoot(child)
	require.NoError(t, err)
	assert.Equal(t, dir, root)
}

func TestFindProjectRoot_NotFound(t *testing.T) {
	dir := t.TempDir() // no .north/
	_, err := FindProjectRoot(dir)
	assert.ErrorIs(t, err, model.ErrProjectNotFound)
}

func TestLoadConfig(t *testing.T) {
	dir := setupTestProject(t)
	s := NewFileStore(dir)

	cfg, err := s.LoadConfig()
	require.NoError(t, err)
	assert.Equal(t, "test-project", cfg.Project)
	assert.Equal(t, "NOR", cfg.Prefix)
	assert.Equal(t, []string{"todo", "in-progress", "done"}, cfg.Statuses)
}

func TestSaveConfig(t *testing.T) {
	dir := setupTestProject(t)
	s := NewFileStore(dir)

	cfg := model.DefaultConfig("updated")
	cfg.Prefix = "TST"
	require.NoError(t, s.SaveConfig(&cfg))

	loaded, err := s.LoadConfig()
	require.NoError(t, err)
	assert.Equal(t, "updated", loaded.Project)
	assert.Equal(t, "TST", loaded.Prefix)
}

func TestLoadIssue(t *testing.T) {
	dir := setupTestProject(t)
	s := NewFileStore(dir)

	expected := testIssue("NOR-1", 1)
	writeTestIssue(t, dir, expected)

	issue, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	assert.Equal(t, "NOR-1", issue.Meta.ID)
	assert.Equal(t, "Test issue NOR-1", issue.Meta.Title)
	assert.Contains(t, issue.Body, "## Description")
}

func TestLoadIssue_NotFound(t *testing.T) {
	dir := setupTestProject(t)
	s := NewFileStore(dir)

	_, err := s.LoadIssue("NOR-999")
	assert.ErrorIs(t, err, model.ErrIssueNotFound)
}

func TestSaveIssue(t *testing.T) {
	dir := setupTestProject(t)
	s := NewFileStore(dir)

	issue := testIssue("NOR-1", 1)
	require.NoError(t, s.SaveIssue(issue))

	loaded, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	assert.Equal(t, issue.Meta.ID, loaded.Meta.ID)
	assert.Equal(t, issue.Meta.Title, loaded.Meta.Title)
	assert.Equal(t, issue.Body, loaded.Body)
}

func TestListIssues_Sorted(t *testing.T) {
	dir := setupTestProject(t)
	s := NewFileStore(dir)

	// Write in reverse order
	writeTestIssue(t, dir, testIssue("NOR-3", 3))
	writeTestIssue(t, dir, testIssue("NOR-1", 1))
	writeTestIssue(t, dir, testIssue("NOR-2", 2))

	issues, err := s.ListIssues()
	require.NoError(t, err)
	require.Len(t, issues, 3)
	assert.Equal(t, "NOR-1", issues[0].Meta.ID)
	assert.Equal(t, "NOR-2", issues[1].Meta.ID)
	assert.Equal(t, "NOR-3", issues[2].Meta.ID)
}

func TestListIssues_Empty(t *testing.T) {
	dir := setupTestProject(t)
	s := NewFileStore(dir)

	issues, err := s.ListIssues()
	require.NoError(t, err)
	assert.NotNil(t, issues)
	assert.Len(t, issues, 0)
}

func TestNextID_NoIssues(t *testing.T) {
	dir := setupTestProject(t)
	s := NewFileStore(dir)

	id, err := s.NextID()
	require.NoError(t, err)
	assert.Equal(t, "NOR-1", id)
}

func TestNextID_WithExisting(t *testing.T) {
	dir := setupTestProject(t)
	s := NewFileStore(dir)

	writeTestIssue(t, dir, testIssue("NOR-1", 1))
	writeTestIssue(t, dir, testIssue("NOR-3", 3))

	id, err := s.NextID()
	require.NoError(t, err)
	assert.Equal(t, "NOR-4", id)
}

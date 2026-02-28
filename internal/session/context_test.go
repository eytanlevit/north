package session

import (
	"testing"

	"github.com/eytanlevit/north/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockStore implements store.Store for testing.
type mockStore struct {
	root   string
	config *model.Config
	issues map[string]*model.Issue
}

func (m *mockStore) ProjectRoot() string                  { return m.root }
func (m *mockStore) LoadConfig() (*model.Config, error)   { return m.config, nil }
func (m *mockStore) SaveConfig(*model.Config) error       { return nil }
func (m *mockStore) SaveIssue(*model.Issue) error         { return nil }
func (m *mockStore) ListIssues() ([]*model.Issue, error)  { return nil, nil }
func (m *mockStore) NextID() (string, error)              { return "", nil }
func (m *mockStore) LoadIssue(id string) (*model.Issue, error) {
	if issue, ok := m.issues[id]; ok {
		return issue, nil
	}
	return nil, model.ErrIssueNotFound
}

func TestBuildContext_WithIssue(t *testing.T) {
	s := &mockStore{
		root:   "/proj",
		config: &model.Config{Project: "test-project", Prefix: "TST"},
		issues: map[string]*model.Issue{
			"TST-1": {
				Meta: model.IssueMeta{
					ID:       "TST-1",
					Title:    "Fix the bug",
					Status:   "open",
					Priority: "high",
				},
				Body: "This is the bug description.\n",
			},
		},
	}

	ctx, err := BuildContext(s, "TST-1")
	require.NoError(t, err)

	assert.Contains(t, ctx, "You are working on issue TST-1")
	assert.Contains(t, ctx, "Fix the bug")
	assert.Contains(t, ctx, "test-project")
	assert.Contains(t, ctx, "This is the bug description.")
}

func TestBuildContext_NoIssue(t *testing.T) {
	s := &mockStore{
		root:   "/proj",
		config: &model.Config{Project: "test-project", Prefix: "TST"},
		issues: map[string]*model.Issue{},
	}

	ctx, err := BuildContext(s, "")
	require.NoError(t, err)
	assert.Empty(t, ctx)
}

func TestBuildContext_WithComments(t *testing.T) {
	s := &mockStore{
		root:   "/proj",
		config: &model.Config{Project: "test-project", Prefix: "TST"},
		issues: map[string]*model.Issue{
			"TST-2": {
				Meta: model.IssueMeta{
					ID:       "TST-2",
					Title:    "Add feature",
					Status:   "in-progress",
					Priority: "medium",
					Comments: []model.Comment{
						{Author: "alice", Date: "2025-01-01", Body: "Looking into this"},
						{Author: "bob", Date: "2025-01-02", Body: "Needs review"},
					},
				},
				Body: "Feature description.\n",
			},
		},
	}

	ctx, err := BuildContext(s, "TST-2")
	require.NoError(t, err)

	assert.Contains(t, ctx, "Comments (2)")
	assert.Contains(t, ctx, "Looking into this")
	assert.Contains(t, ctx, "Needs review")
}

func TestBuildContext_IssueNotFound(t *testing.T) {
	s := &mockStore{
		root:   "/proj",
		config: &model.Config{Project: "test-project", Prefix: "TST"},
		issues: map[string]*model.Issue{},
	}

	_, err := BuildContext(s, "TST-999")
	require.Error(t, err)
	assert.ErrorIs(t, err, model.ErrIssueNotFound)
}

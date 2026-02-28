package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/eytanlevit/north/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockStore implements store.Store for testing.
type mockStore struct {
	root     string
	config   *model.Config
	issues   []*model.Issue
	issueMap map[string]*model.Issue
}

func newMockStore() *mockStore {
	cfg := &model.Config{
		Project:    "test",
		Prefix:     "NOR",
		Statuses:   []string{"todo", "in-progress", "done"},
		Priorities: []string{"low", "medium", "high", "critical"},
	}
	issues := testIssues()
	issueMap := make(map[string]*model.Issue)
	for _, i := range issues {
		issueMap[i.Meta.ID] = i
	}
	return &mockStore{
		root:     "/tmp/test-north",
		config:   cfg,
		issues:   issues,
		issueMap: issueMap,
	}
}

func (m *mockStore) ProjectRoot() string                    { return m.root }
func (m *mockStore) LoadConfig() (*model.Config, error)     { return m.config, nil }
func (m *mockStore) SaveConfig(cfg *model.Config) error     { return nil }
func (m *mockStore) ListIssues() ([]*model.Issue, error)    { return m.issues, nil }
func (m *mockStore) SaveIssue(issue *model.Issue) error     { return nil }
func (m *mockStore) NextID() (string, error)                { return "NOR-5", nil }
func (m *mockStore) LoadIssue(id string) (*model.Issue, error) {
	if i, ok := m.issueMap[id]; ok {
		return i, nil
	}
	return nil, model.ErrIssueNotFound
}

func TestAppModel_Init(t *testing.T) {
	s := newMockStore()
	app := New(s)

	cmd := app.Init()
	assert.NotNil(t, cmd, "Init should return a batch command")
}

func TestAppModel_ConfigLoad(t *testing.T) {
	s := newMockStore()
	app := New(s)

	// Simulate window size first.
	m, _ := app.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	app = m.(AppModel)
	assert.True(t, app.ready)

	// Simulate config loaded.
	m, _ = app.Update(configLoadedMsg{config: s.config})
	app = m.(AppModel)
	assert.NotNil(t, app.config)
	assert.Len(t, app.board.columns, 3)
}

func TestAppModel_IssuesLoad(t *testing.T) {
	s := newMockStore()
	app := New(s)

	// Setup: window size + config.
	m, _ := app.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	app = m.(AppModel)
	m, _ = app.Update(configLoadedMsg{config: s.config})
	app = m.(AppModel)

	// Load issues.
	m, _ = app.Update(issuesLoadedMsg{issues: s.issues})
	app = m.(AppModel)

	// todo column should have 2 issues.
	assert.Len(t, app.board.columns[0].issues, 2)
}

func TestAppModel_BoardNavigation(t *testing.T) {
	s := newMockStore()
	app := New(s)

	// Setup.
	m, _ := app.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	app = m.(AppModel)
	m, _ = app.Update(configLoadedMsg{config: s.config})
	app = m.(AppModel)
	m, _ = app.Update(issuesLoadedMsg{issues: s.issues})
	app = m.(AppModel)

	// Move right.
	m, _ = app.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'l'}})
	app = m.(AppModel)
	assert.Equal(t, 1, app.board.focusedCol)

	// Move down.
	m, _ = app.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	app = m.(AppModel)
}

func TestAppModel_EnterDetail(t *testing.T) {
	s := newMockStore()
	app := New(s)

	// Setup.
	m, _ := app.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	app = m.(AppModel)
	m, _ = app.Update(configLoadedMsg{config: s.config})
	app = m.(AppModel)
	m, _ = app.Update(issuesLoadedMsg{issues: s.issues})
	app = m.(AppModel)

	assert.Equal(t, viewBoard, app.state)

	// Press Enter.
	m, _ = app.Update(tea.KeyMsg{Type: tea.KeyEnter})
	app = m.(AppModel)
	assert.Equal(t, viewDetail, app.state)
	require.NotNil(t, app.detail.issue)
	assert.Equal(t, "NOR-1", app.detail.issue.Meta.ID)

	// Press Esc to go back.
	m, _ = app.Update(tea.KeyMsg{Type: tea.KeyEsc})
	app = m.(AppModel)
	assert.Equal(t, viewBoard, app.state)
}

func TestAppModel_QuitFromBoard(t *testing.T) {
	s := newMockStore()
	app := New(s)

	m, _ := app.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	app = m.(AppModel)
	m, _ = app.Update(configLoadedMsg{config: s.config})
	app = m.(AppModel)

	// Press q.
	_, cmd := app.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	// cmd should be tea.Quit.
	assert.NotNil(t, cmd)
}

func TestAppModel_CtrlCQuits(t *testing.T) {
	s := newMockStore()
	app := New(s)

	m, _ := app.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	app = m.(AppModel)
	m, _ = app.Update(configLoadedMsg{config: s.config})
	app = m.(AppModel)

	_, cmd := app.Update(tea.KeyMsg{Type: tea.KeyCtrlC})
	assert.NotNil(t, cmd)
}

func TestAppModel_FilesChanged(t *testing.T) {
	s := newMockStore()
	app := New(s)

	m, _ := app.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	app = m.(AppModel)
	m, _ = app.Update(configLoadedMsg{config: s.config})
	app = m.(AppModel)

	// Simulate file change — should return batch command (reload + re-arm watch).
	_, cmd := app.Update(filesChangedMsg{})
	assert.NotNil(t, cmd, "filesChangedMsg should trigger reload command")
}

func TestAppModel_View_Loading(t *testing.T) {
	s := newMockStore()
	app := New(s)

	view := app.View()
	assert.Contains(t, view, "Loading")
}

func TestAppModel_View_Board(t *testing.T) {
	s := newMockStore()
	app := New(s)

	m, _ := app.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	app = m.(AppModel)
	m, _ = app.Update(configLoadedMsg{config: s.config})
	app = m.(AppModel)
	m, _ = app.Update(issuesLoadedMsg{issues: s.issues})
	app = m.(AppModel)

	view := app.View()
	assert.Contains(t, view, "TODO")
	assert.Contains(t, view, "NOR-1")
	assert.Contains(t, view, "? help")
}

func TestAppModel_ToggleHelp(t *testing.T) {
	s := newMockStore()
	app := New(s)

	m, _ := app.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	app = m.(AppModel)
	m, _ = app.Update(configLoadedMsg{config: s.config})
	app = m.(AppModel)

	assert.False(t, app.showHelp)

	// Press ?.
	m, _ = app.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'?'}})
	app = m.(AppModel)
	assert.True(t, app.showHelp)

	// Press ? again to toggle off.
	m, _ = app.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'?'}})
	app = m.(AppModel)
	assert.False(t, app.showHelp)
}

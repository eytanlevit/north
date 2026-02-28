package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/eytanlevit/north/internal/agent"
	"github.com/stretchr/testify/assert"
)

func TestSessionModel_Init(t *testing.T) {
	s := newMockStore()
	model := NewSessionModel(s, "test prompt")
	cmd := model.Init()
	assert.NotNil(t, cmd)
}

func TestSessionModel_WindowSize(t *testing.T) {
	s := newMockStore()
	model := NewSessionModel(s, "test")

	m, _ := model.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	sm := m.(SessionModel)
	assert.True(t, sm.ready)
	assert.Equal(t, 120, sm.width)
	assert.Equal(t, 40, sm.height)
}

func TestSessionModel_TabSwitchPanes(t *testing.T) {
	s := newMockStore()
	model := NewSessionModel(s, "test")

	// Set size first
	m, _ := model.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	sm := m.(SessionModel)
	assert.Equal(t, paneChat, sm.focusedPane)

	// Tab to board
	m, _ = sm.Update(tea.KeyMsg{Type: tea.KeyTab})
	sm = m.(SessionModel)
	assert.Equal(t, paneBoard, sm.focusedPane)

	// Tab back to chat
	m, _ = sm.Update(tea.KeyMsg{Type: tea.KeyTab})
	sm = m.(SessionModel)
	assert.Equal(t, paneChat, sm.focusedPane)
}

func TestSessionModel_AgentEvent(t *testing.T) {
	s := newMockStore()
	model := NewSessionModel(s, "test")

	m, _ := model.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	sm := m.(SessionModel)

	// Simulate agent event
	event := agent.SystemEvent{Message: "hello"}
	event.Type = "system"
	m, _ = sm.Update(agentEventMsg{event: event})
	sm = m.(SessionModel)

	assert.Len(t, sm.chat.messages, 1)
	assert.Equal(t, "hello", sm.chat.messages[0].content)
}

func TestSessionModel_AgentError(t *testing.T) {
	s := newMockStore()
	model := NewSessionModel(s, "test")

	m, _ := model.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	sm := m.(SessionModel)

	m, _ = sm.Update(agentErrorMsg{err: assert.AnError})
	sm = m.(SessionModel)
	assert.Error(t, sm.err)
}

func TestSessionModel_AgentDone(t *testing.T) {
	s := newMockStore()
	model := NewSessionModel(s, "test")

	m, _ := model.Update(agentDoneMsg{})
	sm := m.(SessionModel)
	assert.Nil(t, sm.agent)
}

func TestSessionModel_View_Loading(t *testing.T) {
	s := newMockStore()
	model := NewSessionModel(s, "test")

	// Before ready
	assert.Contains(t, model.View(), "Loading")
}

func TestSessionModel_View_Error(t *testing.T) {
	s := newMockStore()
	model := NewSessionModel(s, "test")
	model.err = assert.AnError
	model.ready = true

	view := model.View()
	assert.Contains(t, view, "Agent error")
	assert.Contains(t, view, "ctrl+c")
}

func TestSessionModel_View_Ready(t *testing.T) {
	s := newMockStore()
	model := NewSessionModel(s, "test")

	// After window size
	m, _ := model.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	sm := m.(SessionModel)

	// Load config for board
	m, _ = sm.Update(configLoadedMsg{config: s.config})
	sm = m.(SessionModel)

	view := sm.View()
	assert.Contains(t, view, "tab switch pane")
}

func TestSessionModel_ForwardsBoardMessages(t *testing.T) {
	s := newMockStore()
	model := NewSessionModel(s, "test")

	// Set size
	m, _ := model.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	sm := m.(SessionModel)

	// Config loaded should forward to app
	m, _ = sm.Update(configLoadedMsg{config: s.config})
	sm = m.(SessionModel)
	assert.NotNil(t, sm.app.config)

	// Issues loaded should forward to app
	m, _ = sm.Update(issuesLoadedMsg{issues: s.issues})
	sm = m.(SessionModel)
	assert.Len(t, sm.app.board.columns[0].issues, 2) // todo column
}

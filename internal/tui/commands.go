package tui

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/eytanlevit/north/internal/store"
)

// loadIssuesCmd loads all issues from the store asynchronously.
func loadIssuesCmd(s store.Store) tea.Cmd {
	return func() tea.Msg {
		issues, err := s.ListIssues()
		return issuesLoadedMsg{issues: issues, err: err}
	}
}

// loadConfigCmd loads the project config asynchronously.
func loadConfigCmd(s store.Store) tea.Cmd {
	return func() tea.Msg {
		cfg, err := s.LoadConfig()
		return configLoadedMsg{config: cfg, err: err}
	}
}

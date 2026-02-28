package tui

import (
	"fmt"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/eytanlevit/north/internal/model"
	"github.com/eytanlevit/north/internal/store"
)

type viewState int

const (
	viewBoard viewState = iota
	viewDetail
)

// AppModel is the root Bubble Tea model.
type AppModel struct {
	state       viewState
	board       BoardModel
	detail      DetailModel
	store       store.Store
	config      *model.Config
	help        help.Model
	showHelp    bool
	width       int
	height      int
	ready       bool
	err         error
	projectRoot string
}

// New creates a new AppModel.
func New(s store.Store) AppModel {
	return AppModel{
		state:       viewBoard,
		detail:      NewDetailModel(),
		store:       s,
		help:        help.New(),
		projectRoot: s.ProjectRoot(),
	}
}

// Run starts the TUI program.
func Run(s store.Store) error {
	m := New(s)
	p := tea.NewProgram(m, tea.WithAltScreen())
	_, err := p.Run()
	return err
}

// Init returns the initial commands.
func (m AppModel) Init() tea.Cmd {
	return tea.Batch(
		loadConfigCmd(m.store),
		loadIssuesCmd(m.store),
		watchCmd(m.projectRoot),
	)
}

// Update handles messages.
func (m AppModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ready = true
		m.help.Width = msg.Width
		m.board.SetSize(msg.Width, msg.Height)
		m.detail.SetSize(msg.Width, msg.Height)
		return m, nil

	case configLoadedMsg:
		if msg.err != nil {
			m.err = msg.err
			return m, tea.Quit
		}
		m.config = msg.config
		m.board = NewBoardModel(m.config.Statuses)
		m.board.SetSize(m.width, m.height)
		return m, nil

	case issuesLoadedMsg:
		if msg.err != nil {
			m.err = msg.err
			return m, nil
		}
		m.board.SetIssues(msg.issues)
		return m, nil

	case filesChangedMsg:
		// Reload issues and re-arm watcher.
		return m, tea.Batch(
			loadIssuesCmd(m.store),
			watchCmd(m.projectRoot),
		)

	case errMsg:
		// Non-fatal watcher errors — log but continue.
		return m, nil

	case tea.KeyMsg:
		return m.handleKey(msg)
	}

	return m, nil
}

func (m AppModel) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// Global: ctrl+c always quits.
	if key.Matches(msg, boardKeys.ForceQ) {
		return m, tea.Quit
	}

	// Toggle help.
	if key.Matches(msg, boardKeys.Help) {
		m.showHelp = !m.showHelp
		return m, nil
	}

	switch m.state {
	case viewBoard:
		return m.handleBoardKey(msg)
	case viewDetail:
		return m.handleDetailKey(msg)
	}
	return m, nil
}

func (m AppModel) handleBoardKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch {
	case key.Matches(msg, boardKeys.Quit):
		return m, tea.Quit
	case key.Matches(msg, boardKeys.Up):
		m.board.MoveUp()
	case key.Matches(msg, boardKeys.Down):
		m.board.MoveDown()
	case key.Matches(msg, boardKeys.Left):
		m.board.MoveLeft()
	case key.Matches(msg, boardKeys.Right):
		m.board.MoveRight()
	case key.Matches(msg, boardKeys.Enter):
		issue := m.board.SelectedIssue()
		if issue != nil {
			// Load full issue from store for body/comments.
			full, err := m.store.LoadIssue(issue.Meta.ID)
			if err != nil {
				m.err = err
				return m, nil
			}
			m.detail.SetIssue(full)
			m.detail.SetSize(m.width, m.height)
			m.state = viewDetail
		}
	}
	return m, nil
}

func (m AppModel) handleDetailKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch {
	case key.Matches(msg, detailKeys.Back), key.Matches(msg, detailKeys.Quit):
		m.state = viewBoard
	case key.Matches(msg, detailKeys.Up):
		m.detail.ScrollUp()
	case key.Matches(msg, detailKeys.Down):
		m.detail.ScrollDown()
	}
	return m, nil
}

// View renders the current view.
func (m AppModel) View() string {
	if m.err != nil {
		return fmt.Sprintf("Error: %v\n\nPress any key to exit.", m.err)
	}

	if !m.ready {
		return "Loading..."
	}

	if m.config == nil {
		return "Loading config..."
	}

	var content string
	switch m.state {
	case viewBoard:
		content = m.board.View()
	case viewDetail:
		content = m.detail.View()
	}

	if m.showHelp {
		var helpView string
		switch m.state {
		case viewBoard:
			helpView = m.help.View(boardKeys)
		case viewDetail:
			helpView = m.help.View(detailKeys)
		}
		content += "\n" + helpStyle.Render(helpView)
	} else {
		content += "\n" + helpStyle.Render("? help")
	}

	return content
}

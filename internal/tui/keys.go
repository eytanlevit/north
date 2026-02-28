package tui

import (
	"github.com/charmbracelet/bubbles/key"
)

// BoardKeyMap defines key bindings for the board view.
type BoardKeyMap struct {
	Up     key.Binding
	Down   key.Binding
	Left   key.Binding
	Right  key.Binding
	Enter  key.Binding
	Help   key.Binding
	Quit   key.Binding
	ForceQ key.Binding
}

var boardKeys = BoardKeyMap{
	Up: key.NewBinding(
		key.WithKeys("k", "up"),
		key.WithHelp("k/↑", "up"),
	),
	Down: key.NewBinding(
		key.WithKeys("j", "down"),
		key.WithHelp("j/↓", "down"),
	),
	Left: key.NewBinding(
		key.WithKeys("h", "left"),
		key.WithHelp("h/←", "prev col"),
	),
	Right: key.NewBinding(
		key.WithKeys("l", "right"),
		key.WithHelp("l/→", "next col"),
	),
	Enter: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "open"),
	),
	Help: key.NewBinding(
		key.WithKeys("?"),
		key.WithHelp("?", "help"),
	),
	Quit: key.NewBinding(
		key.WithKeys("q"),
		key.WithHelp("q", "quit"),
	),
	ForceQ: key.NewBinding(
		key.WithKeys("ctrl+c"),
		key.WithHelp("ctrl+c", "quit"),
	),
}

// ShortHelp returns key bindings shown in the mini help view.
func (k BoardKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Up, k.Down, k.Left, k.Right, k.Enter, k.Help, k.Quit}
}

// FullHelp returns key bindings shown in the expanded help view.
func (k BoardKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down, k.Left, k.Right},
		{k.Enter, k.Help, k.Quit},
	}
}

// DetailKeyMap defines key bindings for the detail view.
type DetailKeyMap struct {
	Up     key.Binding
	Down   key.Binding
	Back   key.Binding
	Help   key.Binding
	Quit   key.Binding
	ForceQ key.Binding
}

var detailKeys = DetailKeyMap{
	Up: key.NewBinding(
		key.WithKeys("k", "up"),
		key.WithHelp("k/↑", "scroll up"),
	),
	Down: key.NewBinding(
		key.WithKeys("j", "down"),
		key.WithHelp("j/↓", "scroll down"),
	),
	Back: key.NewBinding(
		key.WithKeys("esc", "b"),
		key.WithHelp("esc/b", "back"),
	),
	Help: key.NewBinding(
		key.WithKeys("?"),
		key.WithHelp("?", "help"),
	),
	Quit: key.NewBinding(
		key.WithKeys("q"),
		key.WithHelp("q", "back"),
	),
	ForceQ: key.NewBinding(
		key.WithKeys("ctrl+c"),
		key.WithHelp("ctrl+c", "quit"),
	),
}

// ShortHelp returns key bindings shown in the mini help view.
func (k DetailKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Up, k.Down, k.Back, k.Help}
}

// FullHelp returns key bindings shown in the expanded help view.
func (k DetailKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down},
		{k.Back, k.Help, k.Quit},
	}
}

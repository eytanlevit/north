package cmd

import (
	"bytes"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompletionCmd_Bash(t *testing.T) {
	root := &cobra.Command{Use: "north"}
	root.AddCommand(NewCompletionCmd())

	buf := new(bytes.Buffer)
	root.SetOut(buf)
	root.SetArgs([]string{"completion", "bash"})

	err := root.Execute()
	require.NoError(t, err)
	assert.NotEmpty(t, buf.String())
}

func TestCompletionCmd_Zsh(t *testing.T) {
	root := &cobra.Command{Use: "north"}
	root.AddCommand(NewCompletionCmd())

	buf := new(bytes.Buffer)
	root.SetOut(buf)
	root.SetArgs([]string{"completion", "zsh"})

	err := root.Execute()
	require.NoError(t, err)
	assert.NotEmpty(t, buf.String())
}

func TestCompletionCmd_Fish(t *testing.T) {
	root := &cobra.Command{Use: "north"}
	root.AddCommand(NewCompletionCmd())

	buf := new(bytes.Buffer)
	root.SetOut(buf)
	root.SetArgs([]string{"completion", "fish"})

	err := root.Execute()
	require.NoError(t, err)
	assert.NotEmpty(t, buf.String())
}

func TestCompletionCmd_InvalidShell(t *testing.T) {
	root := &cobra.Command{Use: "north", SilenceUsage: true, SilenceErrors: true}
	root.AddCommand(NewCompletionCmd())

	root.SetArgs([]string{"completion", "powershell"})
	err := root.Execute()
	assert.Error(t, err)
}

func TestCompletionCmd_NoArgs(t *testing.T) {
	root := &cobra.Command{Use: "north", SilenceUsage: true, SilenceErrors: true}
	root.AddCommand(NewCompletionCmd())

	root.SetArgs([]string{"completion"})
	err := root.Execute()
	assert.Error(t, err)
}

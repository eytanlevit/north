package cmd

import (
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/eytanlevit/north/internal/model"
	"github.com/eytanlevit/north/internal/store"
	"github.com/spf13/cobra"
)

func NewCreateCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create <title>",
		Short: "Create a new issue",
		Args:  cobra.ExactArgs(1),
		RunE:  runCreate,
	}
	cmd.Flags().String("priority", "medium", "Issue priority (low, medium, high, critical)")
	cmd.Flags().StringSlice("labels", nil, "Comma-separated labels")
	cmd.Flags().String("parent", "", "Parent issue ID")
	cmd.Flags().String("body-file", "", "Read body from file (use - for stdin)")
	return cmd
}

func runCreate(cmd *cobra.Command, args []string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	root, err := store.FindProjectRoot(cwd)
	if err != nil {
		return err
	}
	s := store.NewFileStore(root)

	nextID, err := s.NextID()
	if err != nil {
		return err
	}

	today := time.Now().Format("2006-01-02")
	priority, _ := cmd.Flags().GetString("priority")
	labels, _ := cmd.Flags().GetStringSlice("labels")
	parent, _ := cmd.Flags().GetString("parent")
	bodyFile, _ := cmd.Flags().GetString("body-file")

	var body string
	if bodyFile == "-" {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			return fmt.Errorf("read stdin: %w", err)
		}
		body = string(data)
	} else if bodyFile != "" {
		data, err := os.ReadFile(bodyFile)
		if err != nil {
			return fmt.Errorf("read body file: %w", err)
		}
		body = string(data)
	}

	// Ensure body starts with newline for clean formatting
	if body != "" && !strings.HasPrefix(body, "\n") {
		body = "\n" + body
	}

	issue := &model.Issue{
		Meta: model.IssueMeta{
			FormatVersion: 1,
			ID:            nextID,
			Title:         args[0],
			Status:        "todo",
			Priority:      priority,
			Labels:        labels,
			Parent:        parent,
			Created:       today,
			Updated:       today,
		},
		Body: body,
	}

	// Validate against config
	cfg, err := s.LoadConfig()
	if err != nil {
		return err
	}
	if err := model.ValidateIssue(issue, cfg); err != nil {
		return err
	}

	if err := s.SaveIssue(issue); err != nil {
		return err
	}

	fmt.Fprintln(cmd.OutOrStdout(), nextID)
	return nil
}

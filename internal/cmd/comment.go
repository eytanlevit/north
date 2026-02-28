package cmd

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/eytanlevit/north/internal/model"
	"github.com/eytanlevit/north/internal/store"
	"github.com/spf13/cobra"
)

func NewCommentCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "comment <issue-id> [message]",
		Short: "Add a comment to an issue",
		Args:  cobra.RangeArgs(1, 2),
		RunE:  runComment,
	}
	cmd.Flags().String("author", "", "Comment author")
	cmd.Flags().String("file", "", "Read comment from file (use - for stdin)")
	return cmd
}

func runComment(cmd *cobra.Command, args []string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	root, err := store.FindProjectRoot(cwd)
	if err != nil {
		return err
	}
	s := store.NewFileStore(root)

	issue, err := s.LoadIssue(args[0])
	if err != nil {
		return err
	}

	// Determine comment body
	var body string
	file, _ := cmd.Flags().GetString("file")
	if file == "-" {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			return fmt.Errorf("read stdin: %w", err)
		}
		body = string(data)
	} else if file != "" {
		data, err := os.ReadFile(file)
		if err != nil {
			return fmt.Errorf("read file: %w", err)
		}
		body = string(data)
	} else if len(args) >= 2 {
		body = args[1]
	} else {
		return fmt.Errorf("comment message required (as argument or via --file)")
	}

	// Determine author: --author flag → NORTH_AUTHOR env → git user.name → "anonymous"
	author, _ := cmd.Flags().GetString("author")
	if author == "" {
		author = os.Getenv("NORTH_AUTHOR")
	}
	if author == "" {
		out, err := exec.Command("git", "config", "user.name").Output()
		if err == nil {
			author = strings.TrimSpace(string(out))
		}
	}
	if author == "" {
		author = "anonymous"
	}

	comment := model.Comment{
		Author: author,
		Date:   time.Now().Format("2006-01-02"),
		Body:   body,
	}

	issue.Meta.Comments = append(issue.Meta.Comments, comment)
	issue.Meta.Updated = time.Now().Format("2006-01-02")

	if err := s.SaveIssue(issue); err != nil {
		return err
	}

	fmt.Fprintf(cmd.OutOrStdout(), "Added comment to %s\n", issue.Meta.ID)
	return nil
}

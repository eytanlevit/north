package main

import (
	"errors"
	"os"

	"github.com/eytanlevit/north/internal/cmd"
	"github.com/eytanlevit/north/internal/model"
	"github.com/eytanlevit/north/internal/render"
	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{
		Use:           "north",
		Short:         "Filesystem-based project management for devs and AI agents",
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	root.AddCommand(
		cmd.NewInitCmd(),
		cmd.NewCreateCmd(),
		cmd.NewListCmd(),
		cmd.NewShowCmd(),
		cmd.NewUpdateCmd(),
		cmd.NewCommentCmd(),
		cmd.NewEditCmd(),
		cmd.NewContextCmd(),
	)

	if err := root.Execute(); err != nil {
		exitCode := 1
		switch {
		case errors.Is(err, model.ErrInvalidStatus), errors.Is(err, model.ErrInvalidPriority), errors.Is(err, model.ErrInvalidID):
			exitCode = 2
		case errors.Is(err, model.ErrProjectNotFound), errors.Is(err, model.ErrIssueNotFound):
			exitCode = 3
		case errors.Is(err, model.ErrProjectExists):
			exitCode = 4
		}

		// Check if the executed subcommand had --json flag set
		jsonFlag := false
		if sub, _, subErr := root.Find(os.Args[1:]); subErr == nil && sub != root {
			if f := sub.Flags().Lookup("json"); f != nil {
				jsonFlag = f.Value.String() == "true"
			}
		}

		if jsonFlag {
			render.JSONError(os.Stderr, err, exitCode)
		} else {
			render.TextError(os.Stderr, err)
		}

		os.Exit(exitCode)
	}
}

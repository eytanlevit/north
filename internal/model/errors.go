package model

import "errors"

var (
	ErrProjectNotFound = errors.New("north project not found")
	ErrProjectExists   = errors.New("north project already exists")
	ErrIssueNotFound   = errors.New("issue not found")
	ErrInvalidStatus   = errors.New("invalid status")
	ErrInvalidPriority = errors.New("invalid priority")
	ErrInvalidID       = errors.New("invalid issue ID format")
)

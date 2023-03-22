// Code generated by go-swagger; DO NOT EDIT.

// This file is part of MinIO Operator
// Copyright (c) 2023 MinIO, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

package models

// This file was generated by the swagger tool.
// Editing this file might prove futile when you re-run the swagger generate command

import (
	"context"

	"github.com/go-openapi/strfmt"
	"github.com/go-openapi/swag"
)

// ServerDrives server drives
//
// swagger:model serverDrives
type ServerDrives struct {

	// available space
	AvailableSpace int64 `json:"availableSpace,omitempty"`

	// drive path
	DrivePath string `json:"drivePath,omitempty"`

	// endpoint
	Endpoint string `json:"endpoint,omitempty"`

	// healing
	Healing bool `json:"healing,omitempty"`

	// model
	Model string `json:"model,omitempty"`

	// root disk
	RootDisk bool `json:"rootDisk,omitempty"`

	// state
	State string `json:"state,omitempty"`

	// total space
	TotalSpace int64 `json:"totalSpace,omitempty"`

	// used space
	UsedSpace int64 `json:"usedSpace,omitempty"`

	// uuid
	UUID string `json:"uuid,omitempty"`
}

// Validate validates this server drives
func (m *ServerDrives) Validate(formats strfmt.Registry) error {
	return nil
}

// ContextValidate validates this server drives based on context it is used
func (m *ServerDrives) ContextValidate(ctx context.Context, formats strfmt.Registry) error {
	return nil
}

// MarshalBinary interface implementation
func (m *ServerDrives) MarshalBinary() ([]byte, error) {
	if m == nil {
		return nil, nil
	}
	return swag.WriteJSON(m)
}

// UnmarshalBinary interface implementation
func (m *ServerDrives) UnmarshalBinary(b []byte) error {
	var res ServerDrives
	if err := swag.ReadJSON(b, &res); err != nil {
		return err
	}
	*m = res
	return nil
}
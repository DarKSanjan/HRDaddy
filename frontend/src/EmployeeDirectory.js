import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

// Placeholder employee data
const employees = [
  { id: 1, employee_id: 'EMP001', name: 'John Doe', email: 'john@example.com', phone: '12345678', position: 'Developer', date_of_joining: '2023-01-15', salary: 5000 },
  { id: 2, employee_id: 'EMP002', name: 'Jane Smith', email: 'jane@example.com', phone: '87654321', position: 'Designer', date_of_joining: '2022-05-10', salary: 4500 },
];

// EmployeeDirectory component displays a table of employees
function EmployeeDirectory() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Employee Directory
      </Typography>
      {/* Table of employees */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Employee ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Position</TableCell>
              <TableCell>Date of Joining</TableCell>
              <TableCell>Salary</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell>{emp.id}</TableCell>
                <TableCell>{emp.employee_id}</TableCell>
                <TableCell>{emp.name}</TableCell>
                <TableCell>{emp.email}</TableCell>
                <TableCell>{emp.phone}</TableCell>
                <TableCell>{emp.position}</TableCell>
                <TableCell>{emp.date_of_joining}</TableCell>
                <TableCell>{emp.salary}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default EmployeeDirectory; 
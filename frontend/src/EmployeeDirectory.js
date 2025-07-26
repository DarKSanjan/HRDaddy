import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Alert,
  Snackbar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function EmployeeDirectory() {
  // State for employees data
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for dialog (add/edit modal)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    name: '',
    email: '',
    phone_number: '',
    position: '',
    date_of_joining: '',
    salary: ''
  });
  
  // State for notifications
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Fetch employees from backend
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5001/api/employees');
      if (!response.ok) {
        throw new Error('Failed to fetch employees');
      }
      const data = await response.json();
      setEmployees(data);
      setError(null);
    } catch (err) {
      setError('Failed to load employees: ' + err.message);
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load employees on component mount
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Open dialog for adding new employee
  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setFormData({
      employee_id: '',
      name: '',
      email: '',
      phone_number: '',
      position: '',
      date_of_joining: new Date().toISOString().split('T')[0], // Today's date
      salary: ''
    });
    setDialogOpen(true);
  };

  // Open dialog for editing employee
  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      employee_id: employee.employee_id,
      name: employee.name,
      email: employee.email || '',
      phone_number: employee.phone_number,
      position: employee.position,
      date_of_joining: employee.date_of_joining,
      salary: employee.salary.toString()
    });
    setDialogOpen(true);
  };

  // Handle form submission (add or edit)
  const handleSubmit = async () => {
    try {
      const url = editingEmployee 
        ? `http://localhost:5001/api/employees/${editingEmployee.id}`
        : 'http://localhost:5001/api/employees';
      
      const method = editingEmployee ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save employee');
      }

      setSnackbar({
        open: true,
        message: editingEmployee ? 'Employee updated successfully!' : 'Employee added successfully!',
        severity: 'success'
      });
      
      setDialogOpen(false);
      fetchEmployees(); // Refresh the list
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error: ' + err.message,
        severity: 'error'
      });
      console.error('Error saving employee:', err);
    }
  };

  // Handle delete employee
  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/api/employees/${employeeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete employee');
      }

      setSnackbar({
        open: true,
        message: 'Employee deleted successfully!',
        severity: 'success'
      });
      
      fetchEmployees(); // Refresh the list
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error: ' + err.message,
        severity: 'error'
      });
      console.error('Error deleting employee:', err);
    }
  };

  // Close dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEmployee(null);
  };

  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading employees...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={fetchEmployees} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Add button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Employee Directory
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddEmployee}
        >
          Add Employee
        </Button>
      </Box>

      {/* Employee table */}
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
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>{employee.id}</TableCell>
                <TableCell>{employee.employee_id}</TableCell>
                <TableCell>{employee.name}</TableCell>
                <TableCell>{employee.email || '-'}</TableCell>
                <TableCell>{employee.phone_number}</TableCell>
                <TableCell>{employee.position}</TableCell>
                <TableCell>{employee.date_of_joining}</TableCell>
                <TableCell>${employee.salary}</TableCell>
                <TableCell>
                  <IconButton
                    color="primary"
                    onClick={() => handleEditEmployee(employee)}
                    size="small"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => handleDeleteEmployee(employee.id)}
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Employee Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Employee ID"
              value={formData.employee_id}
              onChange={(e) => handleInputChange('employee_id', e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              type="email"
              fullWidth
            />
            <TextField
              label="Phone Number"
              value={formData.phone_number}
              onChange={(e) => handleInputChange('phone_number', e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Position"
              value={formData.position}
              onChange={(e) => handleInputChange('position', e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Date of Joining"
              value={formData.date_of_joining}
              onChange={(e) => handleInputChange('date_of_joining', e.target.value)}
              type="date"
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Salary"
              value={formData.salary}
              onChange={(e) => handleInputChange('salary', e.target.value)}
              type="number"
              required
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingEmployee ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default EmployeeDirectory; 
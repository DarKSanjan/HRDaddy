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

// Animated Icon Component for Employee Actions
function AnimatedActionIcon({ icon: Icon, onClick, color = "primary", size = "small" }) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    if (onClick) onClick();
  };

  return (
    <IconButton
      color={color}
      onClick={handleClick}
      size={size}
      sx={{
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isAnimating ? 'scale(0.8) rotate(-10deg)' : 'scale(1) rotate(0deg)',
        '&:hover': {
          transform: 'scale(1.2)',
          filter: color === 'error' 
            ? 'drop-shadow(0 0 8px rgba(244, 67, 54, 0.6))' 
            : 'drop-shadow(0 0 8px rgba(27, 209, 254, 0.6))',
        },
        '&:active': {
          transform: 'scale(0.9)',
        }
      }}
    >
      <Icon />
    </IconButton>
  );
}

// Animated Add Button Component
function AnimatedAddButton({ onClick }) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    if (onClick) onClick();
  };

  return (
    <Button
      variant="contained"
      startIcon={
        <Box sx={{
          transition: 'all 0.3s ease',
          transform: isAnimating ? 'rotate(90deg) scale(1.2)' : 'rotate(0deg) scale(1)',
        }}>
          <AddIcon />
        </Box>
      }
      onClick={handleClick}
      sx={{
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isAnimating ? 'scale(0.95)' : 'scale(1)',
        '&:hover': {
          transform: 'scale(1.05)',
          boxShadow: '0 8px 25px rgba(27, 209, 254, 0.3)',
        },
        '&:active': {
          transform: 'scale(0.98)',
        }
      }}
    >
      Add Employee
    </Button>
  );
}

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

  // Handle form submission (add or edit employee)
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
        throw new Error('Failed to save employee');
      }

      // Refresh the employee list
      await fetchEmployees();
      
      // Close dialog and show success message
      setDialogOpen(false);
      setSnackbar({
        open: true,
        message: editingEmployee ? 'Employee updated successfully!' : 'Employee added successfully!',
        severity: 'success'
      });
      
    } catch (err) {
      console.error('Error saving employee:', err);
      setSnackbar({
        open: true,
        message: 'Error saving employee: ' + err.message,
        severity: 'error'
      });
    }
  };

  // Handle employee deletion
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

      // Refresh the employee list
      await fetchEmployees();
      
      setSnackbar({
        open: true,
        message: 'Employee deleted successfully!',
        severity: 'success'
      });
      
    } catch (err) {
      console.error('Error deleting employee:', err);
      setSnackbar({
        open: true,
        message: 'Error deleting employee: ' + err.message,
        severity: 'error'
      });
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

  // Show loading state
  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <Typography variant="h6" color="text.secondary">
          Loading employees...
        </Typography>
      </Box>
    );
  }

  // Show error state
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
        <Typography variant="h4" gutterBottom sx={{ fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
          Employee Directory
        </Typography>
        <AnimatedAddButton onClick={handleAddEmployee} />
      </Box>

      {/* Employee table */}
      <TableContainer component={Paper} sx={{ 
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        backgroundColor: '#1a1a1a'
      }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#2a2a2a' }}>
              <TableCell sx={{ 
                fontWeight: 600, 
                fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                color: '#ffffff',
                borderBottom: '2px solid #3a3a3a'
              }}>ID</TableCell>
              <TableCell sx={{ 
                fontWeight: 600, 
                fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                color: '#ffffff',
                borderBottom: '2px solid #3a3a3a'
              }}>Employee ID</TableCell>
              <TableCell sx={{ 
                fontWeight: 600, 
                fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                color: '#ffffff',
                borderBottom: '2px solid #3a3a3a'
              }}>Name</TableCell>
              <TableCell sx={{ 
                fontWeight: 600, 
                fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                color: '#ffffff',
                borderBottom: '2px solid #3a3a3a'
              }}>Email</TableCell>
              <TableCell sx={{ 
                fontWeight: 600, 
                fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                color: '#ffffff',
                borderBottom: '2px solid #3a3a3a'
              }}>Phone</TableCell>
              <TableCell sx={{ 
                fontWeight: 600, 
                fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                color: '#ffffff',
                borderBottom: '2px solid #3a3a3a'
              }}>Position</TableCell>
              <TableCell sx={{ 
                fontWeight: 600, 
                fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                color: '#ffffff',
                borderBottom: '2px solid #3a3a3a'
              }}>Date of Joining</TableCell>
              <TableCell sx={{ 
                fontWeight: 600, 
                fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                color: '#ffffff',
                borderBottom: '2px solid #3a3a3a'
              }}>Salary</TableCell>
              <TableCell sx={{ 
                fontWeight: 600, 
                fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                color: '#ffffff',
                borderBottom: '2px solid #3a3a3a'
              }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id} sx={{ 
                backgroundColor: '#1a1a1a',
                '&:hover': { 
                  backgroundColor: 'rgba(27, 209, 254, 0.1)',
                  transition: 'background-color 0.3s ease'
                }
              }}>
                <TableCell sx={{ 
                  fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                  color: '#d1d5db',
                  borderBottom: '1px solid #2a2a2a'
                }}>{employee.id}</TableCell>
                <TableCell sx={{ 
                  fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                  color: '#d1d5db',
                  borderBottom: '1px solid #2a2a2a'
                }}>{employee.employee_id}</TableCell>
                <TableCell sx={{ 
                  fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                  color: '#d1d5db',
                  borderBottom: '1px solid #2a2a2a'
                }}>{employee.name}</TableCell>
                <TableCell sx={{ 
                  fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                  color: '#d1d5db',
                  borderBottom: '1px solid #2a2a2a'
                }}>{employee.email || '-'}</TableCell>
                <TableCell sx={{ 
                  fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                  color: '#d1d5db',
                  borderBottom: '1px solid #2a2a2a'
                }}>{employee.phone_number}</TableCell>
                <TableCell sx={{ 
                  fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                  color: '#d1d5db',
                  borderBottom: '1px solid #2a2a2a'
                }}>{employee.position}</TableCell>
                <TableCell sx={{ 
                  fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                  color: '#d1d5db',
                  borderBottom: '1px solid #2a2a2a'
                }}>{employee.date_of_joining}</TableCell>
                <TableCell sx={{ 
                  fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
                  color: '#d1d5db',
                  borderBottom: '1px solid #2a2a2a'
                }}>${employee.salary}</TableCell>
                <TableCell sx={{ 
                  borderBottom: '1px solid #2a2a2a'
                }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <AnimatedActionIcon 
                      icon={EditIcon} 
                      onClick={() => handleEditEmployee(employee)}
                      color="primary"
                    />
                    <AnimatedActionIcon 
                      icon={DeleteIcon} 
                      onClick={() => handleDeleteEmployee(employee.id)}
                      color="error"
                    />
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Employee Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
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
              sx={{ '& .MuiInputLabel-root': { fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' } }}
            />
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              fullWidth
              sx={{ '& .MuiInputLabel-root': { fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' } }}
            />
            <TextField
              label="Email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              type="email"
              fullWidth
              sx={{ '& .MuiInputLabel-root': { fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' } }}
            />
            <TextField
              label="Phone Number"
              value={formData.phone_number}
              onChange={(e) => handleInputChange('phone_number', e.target.value)}
              required
              fullWidth
              sx={{ '& .MuiInputLabel-root': { fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' } }}
            />
            <TextField
              label="Position"
              value={formData.position}
              onChange={(e) => handleInputChange('position', e.target.value)}
              required
              fullWidth
              sx={{ '& .MuiInputLabel-root': { fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' } }}
            />
            <TextField
              label="Date of Joining"
              value={formData.date_of_joining}
              onChange={(e) => handleInputChange('date_of_joining', e.target.value)}
              type="date"
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiInputLabel-root': { fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' } }}
            />
            <TextField
              label="Salary"
              value={formData.salary}
              onChange={(e) => handleInputChange('salary', e.target.value)}
              type="number"
              required
              fullWidth
              sx={{ '& .MuiInputLabel-root': { fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} sx={{ fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" sx={{ fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
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
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import user, password, host, port, name
from datetime import datetime

# Flask app and CORS
app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{user}:{password}@{host}:{port}/{name}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Employee model
default_date = datetime.utcnow
class Employee(db.Model):
    __tablename__ = 'employees'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=True)
    phone_number = db.Column(db.String(20), nullable=False)
    position = db.Column(db.String(100), nullable=False)
    date_of_joining = db.Column(db.Date, nullable=False, default=default_date)
    salary = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'name': self.name,
            'email': self.email,
            'phone_number': self.phone_number,
            'position': self.position,
            'date_of_joining': self.date_of_joining.strftime('%Y-%m-%d'),
            'salary': self.salary
        }

@app.route("/")
def index():
    return """<a href=\"/employee_directory\"><button>Go to Page</button></a>"""


@app.route("/employee_directory")
def employee_directory():
    return """Hello!"""

# -----------------------------
# Employee API Endpoints (CRUD)
# -----------------------------

# 1. Get all employees
@app.route('/api/employees', methods=['GET'])
def get_employees():
    """
    Fetch all employees from the database and return as JSON list.
    Frontend (React) will call this endpoint to display the employee table.
    """
    employees = Employee.query.all()
    return jsonify([emp.to_dict() for emp in employees]), 200

# 2. Add a new employee
@app.route('/api/employees', methods=['POST'])
def add_employee():
    """
    Add a new employee to the database.
    Expects JSON data from frontend with all required fields.
    """
    data = request.get_json()
    # Validate required fields
    required_fields = ['employee_id', 'name', 'phone_number', 'position', 'date_of_joining', 'salary']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400
    try:
        new_employee = Employee(
            employee_id=data['employee_id'],
            name=data['name'],
            email=data.get('email'),  # Optional
            phone_number=data['phone_number'],
            position=data['position'],
            date_of_joining=datetime.strptime(data['date_of_joining'], '%Y-%m-%d').date(),
            salary=float(data['salary'])
        )
        db.session.add(new_employee)
        db.session.commit()
        return jsonify(new_employee.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# 3. Update an employee
@app.route('/api/employees/<int:id>', methods=['PUT'])
def update_employee(id):
    """
    Update an existing employee's details.
    Expects JSON data from frontend with fields to update.
    """
    employee = Employee.query.get_or_404(id)
    data = request.get_json()
    try:
        # Update fields if present in request
        for field in ['employee_id', 'name', 'email', 'phone_number', 'position', 'date_of_joining', 'salary']:
            if field in data:
                if field == 'date_of_joining':
                    setattr(employee, field, datetime.strptime(data[field], '%Y-%m-%d').date())
                elif field == 'salary':
                    setattr(employee, field, float(data[field]))
                else:
                    setattr(employee, field, data[field])
        db.session.commit()
        return jsonify(employee.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# 4. Delete an employee
@app.route('/api/employees/<int:id>', methods=['DELETE'])
def delete_employee(id):
    """
    Delete an employee from the database by ID.
    Frontend will call this endpoint when user clicks delete.
    """
    employee = Employee.query.get_or_404(id)
    try:
        db.session.delete(employee)
        db.session.commit()
        return jsonify({'message': 'Employee deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


if __name__ == "__main__":
    try:
        db.create_all()
        print(
            f"Connection to the {host} for user {user} created successfully."
        )
    except Exception as ex:
        print("Connection could not be made due to the following error: \n", ex)
    app.run(debug=True, port=5001)

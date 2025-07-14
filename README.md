# 💼 HRDaddy

**HRDaddy** is a lightweight HR management system powered by Flask and PostgreSQL.

---

## 🛠 Setup Instructions

Before running `app.py`, create a file named `config.py` in the backend directory with the following contents:

```python
# config.py

user = "your_database_username"
password = "your_database_password"
host = "your_database_host"       # Use '127.0.0.1' for localhost
port = 5432                       # Default PostgreSQL port
name = "your_database_name"       # Common defaults: 'HRDaddy' or 'postgres'

from flask import Flask
from flask_cors import CORS
from sqlalchemy import create_engine

# defining the database credentials
user = "postgres"
password = "Sanjankrishna@13"
host = "127.0.0.1"
port = 5432
database = "HRDaddy"


def get_connection():
    return create_engine(url=f"postgresql://{user}:{password}@{host}:{port}/{database}")


app = Flask(__name__)
CORS(app)


@app.route("/")
def index():
    return """<a href="/employee_directory"><button>Go to Page</button></a>"""


@app.route("/employee_directory")
def employee_directory():
    return """Hello!"""


if __name__ == "__main__":
    try:
        engine = get_connection()
        print(f"Connection to the {host} for user {user} created successfully.")
    except Exception as ex:
        print("Connection could not be made due to the following error: \n", ex)
    app.run(debug=True)

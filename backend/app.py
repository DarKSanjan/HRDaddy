from flask import Flask
from flask_cors import CORS
from sqlalchemy import create_engine
from config import user, password, host, port, name

# defining the database credentials
database_user = user
database_password = password
host = host
port = port
database_name = name


def get_connection():
    return create_engine(url=f"postgresql://{user}:{password}@{host}:{port}/{name}")


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
        print(
            f"Connection to the {host} for user {database_user} created successfully."
        )
    except Exception as ex:
        print("Connection could not be made due to the following error: \n", ex)
    app.run(debug=True)

from app import create_app

app = create_app()

if __name__ == "__main__":
    # O servidor fica acessível entre containers pela interface 0.0.0.0.
    app.run(host="0.0.0.0", port=5000)

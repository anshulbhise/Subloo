
import requests

BASE_URL = "http://127.0.0.1:5000"

session = requests.Session()

user_data = {
    "full_name": "Subloo Test User",
    "email": "subloo.test@example.com",
    "password": "SublooTest@2026Secure"
}

try:
    response = session.post(
        f"{BASE_URL}/api/auth/register",
        json=user_data
    )

    print("\nHTTP Status:", response.status_code)
    print("\nServer Response:")
    print(response.text)

except requests.RequestException as error:
    print("Request failed:", error)

# TEST LOGIN
login_response = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={
        "email": "subloo.test@example.com",
        "password": "SublooTest@2026Secure"
    }
)

print("\nLOGIN STATUS:", login_response.status_code)
print("LOGIN RESPONSE:", login_response.text)

# TEST CURRENT USER SESSION
me_response = requests.get(
    f"{BASE_URL}/api/auth/me",
    cookies=login_response.cookies
)

print("\nCURRENT USER STATUS:", me_response.status_code)
print("CURRENT USER RESPONSE:", me_response.text)
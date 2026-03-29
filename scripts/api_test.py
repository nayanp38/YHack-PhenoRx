import requests

url = "https://api.cpicpgx.org/v1/allele"
response = requests.get(url)
data = response.json()
print(data)
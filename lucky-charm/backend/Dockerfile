# For Phala Cloud (x86_64), build with: docker build --platform linux/amd64 -t ...
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py extract.py .

ENV PORT=8080
EXPOSE 8080

CMD ["python", "-u", "app.py"]

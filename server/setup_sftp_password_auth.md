# Setting Up SFTP Password Authentication

AWS Transfer Family doesn't natively support password authentication - it only supports SSH key authentication. To enable password authentication, you need to set up a custom identity provider.

## Steps to Enable Password Authentication:

### 1. Run Database Migration
First, apply the database migration to create the `sftp_auth` table:

```bash
cd D:\SFTP\server
alembic upgrade head
```

### 2. Deploy Custom Identity Provider

You have two options:

#### Option A: Deploy as AWS Lambda Function (Recommended)

1. Create a Lambda deployment package:
```bash
# Create deployment directory
mkdir sftp_auth_lambda
cd sftp_auth_lambda

# Copy the authentication code
cp ../app/services/sftp_custom_auth.py lambda_function.py

# Install dependencies
pip install bcrypt sqlalchemy psycopg2-binary boto3 -t .

# Create ZIP file
zip -r sftp_auth_lambda.zip .
```

2. Deploy to AWS Lambda:
```bash
aws lambda create-function \
  --function-name SftpCustomAuthProvider \
  --runtime python3.9 \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://sftp_auth_lambda.zip \
  --environment Variables={DATABASE_URL=your_database_url,AWS_S3_BUCKET=your_bucket,AWS_ROLE_ARN=your_role_arn}
```

3. Create API Gateway REST API:
```bash
# Create REST API
aws apigateway create-rest-api --name SftpAuthApi

# Configure it to trigger the Lambda function
# (Follow AWS documentation for detailed steps)
```

#### Option B: Use AWS Transfer Family with Service-Managed Users

For simpler setup, you can continue using SSH keys only. AWS Transfer Family service-managed users only support SSH key authentication.

### 3. Configure AWS Transfer Family Server

Update your Transfer Family server to use the custom identity provider:

```bash
aws transfer update-server \
  --server-id YOUR_SERVER_ID \
  --identity-provider-type API_GATEWAY \
  --identity-provider-details Url=https://your-api-gateway-url.execute-api.region.amazonaws.com/prod \
  --identity-provider-details InvocationRole=arn:aws:iam::YOUR_ACCOUNT:role/transfer-invocation-role
```

### 4. Set SFTP Passwords for Users

Use the API endpoints to set passwords:

```bash
# Set SFTP password for a user
curl -X PUT http://localhost:3001/api/users/{user_id}/sftp/password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "SecurePassword123!"}'

# Switch authentication method to password
curl -X PUT http://localhost:3001/api/users/{user_id}/sftp/auth-method \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"auth_method": "password"}'
```

## Alternative: Continue Using SSH Keys Only

If setting up a custom identity provider is too complex, you can continue using SSH keys:

1. **Generate SSH Key Pair for User:**
   - Use the existing `/api/users/generate-ssh-key` endpoint
   - This generates both public and private keys

2. **Store Private Key Securely:**
   - The private key is stored in the database
   - Users can download it once during account creation

3. **Configure SFTP Client:**
   - Users configure their SFTP client with the private key
   - No password needed

## Testing SFTP Access

### With Password (after setting up custom identity provider):
```bash
sftp -P 22 username@your-transfer-server.amazonaws.com
# Enter password when prompted
```

### With SSH Key (current setup):
```bash
sftp -i private_key.pem -P 22 username@your-transfer-server.amazonaws.com
# No password needed
```

## Important Notes:

1. **AWS Transfer Family Limitation:** AWS Transfer Family service-managed users only support SSH key authentication. Password authentication requires a custom identity provider.

2. **Security Considerations:**
   - Store passwords securely (hashed with bcrypt)
   - Use strong passwords (minimum 8 characters)
   - Consider implementing password policies
   - Enable MFA if possible

3. **Database Structure:**
   - The `sftp_auth` table stores both password hashes and SSH keys
   - Users can have both authentication methods configured
   - The `auth_method` field determines which method is active

4. **Migration Path:**
   - Existing users with SSH keys will continue to work
   - You can gradually add password authentication for new users
   - Users can switch between authentication methods
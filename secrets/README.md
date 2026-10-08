# Create these files on the production host, NEVER commit real secrets:
#
#   secrets/glpi_db_password    — the GLPI database password
#   secrets/settings_secret_key — random string for signing session settings
#
# In docker-compose.yml reference them as:
#   secrets:
#     - glpi_db_password
#
# And the GLPI image reads GLPI_DB_PASSWORD_FILE=/run/secrets/glpi_db_password
#
# DO NOT put actual secrets in this directory. See README.md for instructions.

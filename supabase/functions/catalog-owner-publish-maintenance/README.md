# Retired endpoint

`catalog-owner-publish-maintenance` is permanently retired.

The deployed and repository implementations must return HTTP 410 and must not contain service-role credentials, user creation, role assignment, MFA enrollment, or product publication logic.

Official product publication belongs to the authenticated Super Admin AAL2 application flow and its canonical database capability gates.

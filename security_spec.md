## Data Invariants
- A patient record must belong to a verified doctor (ownerId).
- A checklist record must be associated with a valid patient document and share the same ownerId.

## The "Dirty Dozen" Payloads
1. Create patient with `ownerId` of another user.
2. Update patient metadata (e.g. `ownerId`) after creation.
3. Inject 1MB string into a patient's `name`.
4. Create patient without a `bedNumber`.
5. Access patient list without being signed in.
6. Delete a patient without being its owner.
7. Create a checklist for a patient the user doesn't own.
8. Update checklist `date` to a date in the future.
9. Inject invalid enum value into `bleeding` field.
10. Update patient `updatedAt` with a client-side timestamp.
11. Query all patients in the system instead of just the user's specific patients.
12. Modify `id` path variable to be an excessively large string.

## The Test Runner
```typescript
// firestore.rules.test.ts (Pseudo-code/Plan)
// 1. Unauthenticated users cannot read/write anything.
// 2. Users can only read/write patients where resource.data.ownerId == request.auth.uid.
// 3. Size limits on strings (name, bedNumber) are enforced.
// 4. Subcollection checklists must inherit permissions from parent patients.
```

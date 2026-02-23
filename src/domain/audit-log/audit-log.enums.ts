export enum AuditAction {
	// ── Document lifecycle ──────────────────────────────────────────────────────
	/** A new document record was created (before any version is uploaded). */
	DOCUMENT_CREATED = "DOCUMENT_CREATED",
	/** Document metadata (e.g. name) was updated. */
	DOCUMENT_UPDATED = "DOCUMENT_UPDATED",
	/** Document was soft-archived (isArchived = true). */
	DOCUMENT_ARCHIVED = "DOCUMENT_ARCHIVED",
	/** Document was restored from the archive. */
	DOCUMENT_RESTORED = "DOCUMENT_RESTORED",
	/** Document and all its versions were permanently deleted. */
	DOCUMENT_DELETED = "DOCUMENT_DELETED",

	// ── Document versions ───────────────────────────────────────────────────────
	/** A new version was uploaded for an existing document. */
	VERSION_UPLOADED = "VERSION_UPLOADED",
	/** A specific version was deleted. */
	VERSION_DELETED = "VERSION_DELETED",

	// ── Download / sharing ──────────────────────────────────────────────────────
	/** A time-limited download link was generated for a document version. */
	DOWNLOAD_LINK_GENERATED = "DOWNLOAD_LINK_GENERATED",
	/** A document version was directly downloaded. */
	DOCUMENT_DOWNLOADED = "DOCUMENT_DOWNLOADED",

	// ── Access control ──────────────────────────────────────────────────────────
	/** A user was granted access to a document (access policy created). */
	ACCESS_GRANTED = "ACCESS_GRANTED",
	/** A user's access to a document was revoked (access policy deleted). */
	ACCESS_REVOKED = "ACCESS_REVOKED",
	/** A user's permission level on a document was changed (e.g. READ → WRITE). */
	ACCESS_UPDATED = "ACCESS_UPDATED",
}

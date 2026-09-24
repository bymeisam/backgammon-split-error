-- CreateIndex
CREATE INDEX `Decision_countAsDecision_rawError_kind_classification_errorS_idx` ON `Decision`(`countAsDecision`, `rawError`, `kind`, `classification`, `errorSeverity`);

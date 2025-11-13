"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestPriority = exports.RequestStatus = exports.ImageStatus = void 0;
var ImageStatus;
(function (ImageStatus) {
    ImageStatus["UPLOADING"] = "UPLOADING";
    ImageStatus["PROCESSING"] = "PROCESSING";
    ImageStatus["READY"] = "READY";
    ImageStatus["ERROR"] = "ERROR";
})(ImageStatus || (exports.ImageStatus = ImageStatus = {}));
// Imaging Request Scheduling
var RequestStatus;
(function (RequestStatus) {
    RequestStatus["PENDING"] = "PENDING";
    RequestStatus["SCHEDULED"] = "SCHEDULED";
    RequestStatus["IN_PROGRESS"] = "IN_PROGRESS";
    RequestStatus["COMPLETED"] = "COMPLETED";
    RequestStatus["FAILED"] = "FAILED";
    RequestStatus["CANCELLED"] = "CANCELLED";
})(RequestStatus || (exports.RequestStatus = RequestStatus = {}));
var RequestPriority;
(function (RequestPriority) {
    RequestPriority["LOW"] = "LOW";
    RequestPriority["MEDIUM"] = "MEDIUM";
    RequestPriority["HIGH"] = "HIGH";
    RequestPriority["URGENT"] = "URGENT";
})(RequestPriority || (exports.RequestPriority = RequestPriority = {}));

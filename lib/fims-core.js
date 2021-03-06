//"use strict";

var async = require("async");
var equal = require('fast-deep-equal');
var jsonld = require("jsonld");
var request = require("request");

var internalContext = "http://fims.tv/context/default";
var minimalContext = "http://fims.tv/context/minimal";
var defaultContextURL = internalContext;

var contextCacheExpirationTime = 300000;
var contextCache = {};

contextCache[minimalContext] = {
    context: {
        "@context": {
            "dc": "http://purl.org/dc/elements/1.1/",
            "default": "urn:ebu:metadata-schema:ebuCore_2012",
            "ebucore": "http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#",
            "fims": "http://fims.tv#",
            "owl": "http://www.w3.org/2002/07/owl#",
            "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
            "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
            "skos": "http://www.w3.org/2004/02/skos/core#",
            "xsd": "http://www.w3.org/2001/XMLSchema#",
            "xsi": "http://www.w3.org/2001/XMLSchema-instance",

            "id": "@id",
            "type": "@type"
        }
    }
}

contextCache[internalContext] = {
    context: {
        "@context": {
            // Namespace abbreviations

            "ebucore": "http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#",
            "fims": "http://fims.tv#",
            "other": "http//other#",
            "owl": "http://www.w3.org/2002/07/owl#",
            "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
            "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
            "xsd": "http://www.w3.org/2001/XMLSchema#",

            // General definition

            "id": "@id",
            "type": "@type",

            "label": "rdfs:label",
            "url": "xsd:anyURI",

            // EBUcore definitions

            "dateCreated": "ebucore:dateCreated",
            "dateModified": "ebucore:dateModified",

            // FIMS definitions

            "Service": "fims:Service",
            "hasResource": {
                "@id": "fims:hasServiceResource",
                "@type": "@id"
            },
            "acceptsJobType": {
                "@id": "fims:acceptsJobType",
                "@type": "@id"
            },
            "acceptsJobProfile": {
                "@id": "fims:acceptsJobProfile",
                "@type": "@id"
            },

            "inputLocation": {
                "@id": "fims:hasJobInputLocation",
                "@type": "@id"
            },
            "outputLocation": {
                "@id": "fims:hasJobOutputLocation",
                "@type": "@id"
            },

            "ServiceResource": "fims:ServiceResource",
            "resourceType": {
                "@id": "fims:resourceType",
                "@type": "@id"
            },

            "JobProfile": "fims:JobProfile",
            "hasInputParameter": {
                "@id": "fims:hasInputParameter",
                "@type": "@id"
            },
            "hasOptionalInputParameter": {
                "@id": "fims:hasOptionalInputParameter",
                "@type": "@id"
            },
            "hasOutputParameter": {
                "@id": "fims:hasOutputParameter",
                "@type": "@id"
            },

            "JobParameter": "fims:JobParameter",
            "jobProperty": {
                "@id": "fims:jobProperty",
                "@type": "@id"
            },
            "parameterType": {
                "@id": "fims:jobParameterType",
                "@type": "@id"
            },

            "Locator": "fims:Locator",
            "httpEndpoint": {
                "@id": "fims:httpEndpoint",
                "@type": "xsd:anyURI"
            },

            "awsS3Bucket": "fims:amazonWebServicesS3Bucket",
            "awsS3Key": "fims:amazonWebServicesS3Key",
            "azureBlobStorageAccount": "fims:microsoftAzureBlobStorageAccount",
            "azureBlobStorageContainer": "fims:microsoftAzureBlobStorageContainer",
            "azureBlobStorageObjectName": "fims:microsoftAzureBlobStorageObjectName",
            "googleCloudStorageBucket": "fims:googleCloudStorageBucket",
            "googleCloudStorageObjectName": "fims:googleCloudStorageObjectName",
            "uncPath": "fims:uncPath",

            "AmeJob": "fims:AmeJob",
            "CaptureJob": "fims:CaptureJob",
            "QAJob": "fims:QAJob",
            "TransformJob": "fims:TransformJob",
            "TransferJob": "fims:TransferJob",

            "jobProfile": {
                "@id": "fims:hasJobProfile",
                "@type": "@id"
            },

            "jobStatus": {
                "@id": "fims:hasJobStatus",
                "@type": "fims:JobStatus"
            },

            "jobStatusReason": {
                "@id": "fims:hasJobStatusReason",
                "@type": "xsd:string"
            },

            "jobProcess": {
                "@id": "fims:hasJobProcess",
                "@type": "@id"
            },

            "jobInput": {
                "@id": "fims:hasJobInput",
                "@type": "@id"
            },

            "jobOutput": {
                "@id": "fims:hasJobOutput",
                "@type": "@id"
            },

            "JobParameterBag": "fims:JobParameterBag",

            "JobProcess": "fims:JobProcess",

            "job": {
                "@id": "fims:hasJob",
                "@type": "@id"
            },

            "jobProcessStatus": {
                "@id": "fims:hasJobProcessStatus",
                "@type": "fims:JobProcessStatus"
            },

            "jobProcessStatusReason": {
                "@id": "fims:hasJobProcessStatusReason",
                "@type": "xsd:string"
            },

            "jobAssignment": {
                "@id": "fims:hasJobAssignment",
                "@type": "@id"
            },

            "JobAssignment": "fims:JobAssignment",

            "asyncEndpoint": "fims:hasAsyncEndpoint",
            "AsyncEndpoint": "fims:AsyncEndpoint",

            "asyncSuccess": {
                "@id": "fims:asyncEndpointSuccess",
                "@type": "xsd:anyURI"
            },
            "asyncFailure": {
                "@id": "fims:asyncEndpointFailure",
                "@type": "xsd:anyURI"
            },

            // Default namespace for custom attributes

            "@vocab": "http://other#"
        }
    }
}


function removeExpiredContexts() {
    for (url in contextCache) {
        if (contextCache[url].expirationTime && contextCache[url].expirationTime < Date.now()) {
            delete contextCache[url]
        }
    }
}

// grab the built-in node.js doc loader
var nodeDocumentLoader = jsonld.documentLoaders.node();

var customLoader = function (url, callback) {
    removeExpiredContexts();

    // check if url is in cache
    if (url in contextCache) {
        return callback(
            null, {
                contextUrl: null, // this is for a context via a link header
                document: contextCache[url].context, // this is the actual document that was loaded
                documentUrl: url // this is the actual context URL after redirects
            });
    }

    // call the underlining documentLoader using the callback API and store result in cache
    nodeDocumentLoader(url, function (err, result) {
        if (!err && result) {
            contextCache[url] = {
                context: result.document,
                expirationTime: Date.now() + contextCacheExpirationTime
            };
        }

        callback(err, result);
    });
};
jsonld.documentLoader = customLoader;

function getDefaultContext() {
    return getContext(defaultContextURL);
}

function getDefaultContextURL() {
    return defaultContextURL;
}

function setDefaultContextURL(url) {
    defaultContextURL = url;
};

function getContextCacheExpirationTime() {
    return contextCacheExpirationTime;
};

function setContextCacheExpirationTime(expirationTime) {
    contextCacheExpirationTime = expirationTime;
};

function getContext(url) {
    removeExpiredContexts();
    return contextCache[url].context;
};

function putContext(url, context) {
    contextCache[url] = {
        context: context
    }
};

function removeContext(url) {
    delete contextCache[url];
};

function compact(doc, context, callback) {
    if (!callback && typeof (context) === 'function') {
        callback = context;
        context = defaultContextURL;
    }

    return jsonld.compact(doc, context, callback);
};

function expand(compacted, callback) {
    return jsonld.expand(compacted, callback);
}

function flatten(doc, callback) {
    return jsonld.flatten(doc, callback);
}

function frame(doc, frame, callback) {
    return jsonld.frame(doc, frame, callback);
}

function normalize(doc, options, callback) {
    if (!callback && typeof (options) === 'function') {
        callback = options;
        options = {
            algorithm: 'URDNA2015',
            format: 'application/nquads'
        };
    }

    return jsonld.normalize(doc, options, callback);
}

function toRDF(doc, options, callback) {
    if (!callback && typeof (options) === 'function') {
        callback = options;
        options = {
            format: 'application/nquads'
        };
    }
    return jsonld.toRDF(doc, options, callback);
}

function fromRDF(nquads, options, callback) {
    if (!callback && typeof (options) === 'function') {
        callback = options;
        options = {
            format: 'application/nquads'
        };
    }
    return jsonld.fromRDF(nquads, options, callback);
}

function Service(label, hasResource, acceptsJobType, acceptsJobProfile, inputLocation, outputLocation) {
    this["@context"] = internalContext;
    this.type = "Service";
    this.label = label;
    this.hasResource = hasResource;
    this.acceptsJobType = acceptsJobType;
    this.acceptsJobProfile = acceptsJobProfile;
    this.inputLocation = inputLocation;
    this.outputLocation = outputLocation;
}

function ServiceResource(resourceType, httpEndpoint) {
    this["@context"] = internalContext;
    this.type = "ServiceResource";
    this.resourceType = resourceType;
    this.httpEndpoint = httpEndpoint;
}

function JobProfile(label, hasInputParameter, hasOutputParameter, hasOptionalInputParameter) {
    this["@context"] = internalContext;
    this.type = "JobProfile";
    this.label = label;
    this.hasInputParameter = hasInputParameter;
    this.hasOutputParameter = hasOutputParameter;
    this.hasOptionalInputParameter = hasOptionalInputParameter;
}

function JobParameter(jobProperty, parameterType) {
    this["@context"] = internalContext;
    this.type = "JobParameter";
    this.jobProperty = jobProperty;
    this.parameterType = parameterType;
}

function JobParameterBag(jobParameters) {
    this["@context"] = internalContext;
    this.type = "JobParameterBag";

    if (jobParameters) {
        for (var prop in jobParameters) {
            this[prop] = jobParameters[prop];
        }
    }
}

function Locator(locatorProperties) {
    this["@context"] = internalContext;
    this.type = "Locator";

    if (locatorProperties) {
        for (var prop in locatorProperties) {
            this[prop] = locatorProperties[prop];
        }
    }
}

function AsyncEndpoint(success, failure) {
    this["@context"] = internalContext;
    this.type = "AsyncEndpoint";
    this.asyncSuccess = success;
    this.asyncFailure = failure;
}

function AmeJob(jobProfile, jobInput, asyncEndpoint) {
    this["@context"] = internalContext;
    this.type = "AmeJob";
    this.jobProfile = jobProfile;
    this.jobInput = jobInput;
    this.asyncEndpoint = asyncEndpoint;

    this.jobStatus = "New";
    this.jobStatusReason = null;
    this.jobProcess = null;
    this.jobOutput = null;
}

function CaptureJob(jobProfile, jobInput, asyncEndpoint) {
    this["@context"] = internalContext;
    this.type = "CaptureJob";
    this.jobProfile = jobProfile;
    this.jobInput = jobInput;
    this.asyncEndpoint = asyncEndpoint;

    this.jobStatus = "New";
    this.jobStatusReason = null;
    this.jobProcess = null;
    this.jobOutput = null;
}

function QAJob(jobProfile, jobInput, asyncEndpoint) {
    this["@context"] = internalContext;
    this.type = "QAJob";
    this.jobProfile = jobProfile;
    this.jobInput = jobInput;
    this.asyncEndpoint = asyncEndpoint;

    this.jobStatus = "New";
    this.jobStatusReason = null;
    this.jobProcess = null;
    this.jobOutput = null;
}

function TransferJob(jobProfile, jobInput, asyncEndpoint) {
    this["@context"] = internalContext;
    this.type = "TransferJob";
    this.jobProfile = jobProfile;
    this.jobInput = jobInput;
    this.asyncEndpoint = asyncEndpoint;

    this.jobStatus = "New";
    this.jobStatusReason = null;
    this.jobProcess = null;
    this.jobOutput = null;
}

function TransformJob(jobProfile, jobInput, asyncEndpoint) {
    this["@context"] = internalContext;
    this.type = "TransformJob";
    this.jobProfile = jobProfile;
    this.jobInput = jobInput;
    this.asyncEndpoint = asyncEndpoint;

    this.jobStatus = "New";
    this.jobStatusReason = null;
    this.jobProcess = null;
    this.jobOutput = null;
}

function JobProcess(job) {
    this["@context"] = internalContext;
    this.type = "JobProcess";
    this.job = job;
    this.jobAssignment = null;
    this.jobProcessStatus = "New";
    this.jobProcessStatusReason = null;
    this.jobStart = null;
    this.jobDuration = null;
    this.jobEnd = null;
}

function JobAssignment(jobProcess) {
    this["@context"] = internalContext;
    this.type = "JobAssignment";
    this.jobProcess = jobProcess;
    this.jobProcessStatus = "New";
    this.jobProcessStatusReason = null;
}


function httpGet(url, context, callback) {
    if (!callback && typeof (context) === 'function') {
        callback = context;
        context = defaultContextURL;
    }

    async.waterfall([
        (callback) => {
            request({
                url: url,
                method: "GET",
                json: true
            }, callback);
        },
        (response, body, callback) => {
            if (response.statusCode !== 200) {
                return callback(response.statusCode, body);
            } else if (body) {
                if (body.constructor === Array) {
                    return async.map(body, (resource, callback) => {
                        return jsonld.compact(resource, context, (err, response) => {
                            callback(err, response);
                        });
                    }, callback);
                } else {
                    return jsonld.compact(body, context, (err, response) => {
                        return callback(err, response);
                    });
                }
            } else {
                return callback();
            }
        }
    ], callback);
}

function httpPost(url, resource, context, callback) {
    if (!callback && typeof (context) === 'function') {
        callback = context;
        context = defaultContextURL;
    }

    async.waterfall([
        (callback) => {
            request({
                url: url,
                method: "POST",
                json: true,
                body: resource
            }, callback);
        },
        (response, body, callback) => {
            if (response.statusCode !== 201) {
                return callback(response.statusCode, body);
            } else if (body) {
                if (body.constructor === Array) {
                    return async.map(body, (resource, callback) => {
                        return jsonld.compact(resource, context, (err, response) => {
                            return callback(err, response);
                        });
                    }, callback);
                } else {
                    return jsonld.compact(body, context, (err, response) => {
                        return callback(err, response);
                    });
                }
            } else {
                return callback();
            }
        }
    ], callback);
}

function httpPut(url, resource, context, callback) {
    if (!callback && typeof (context) === 'function') {
        callback = context;
        context = defaultContextURL;
    }

    async.waterfall([
        (callback) => {
            request({
                url: url,
                method: "PUT",
                json: true,
                body: resource
            }, callback);
        },
        (response, body, callback) => {
            if (response.statusCode !== 200) {
                return callback(response.statusCode, body);
            } else if (body) {
                if (body.constructor === Array) {
                    return async.map(body, (resource, callback) => {
                        return jsonld.compact(resource, context, (err, response) => {
                            return callback(err, response);
                        });
                    }, callback);
                } else {
                    return jsonld.compact(body, context, (err, response) => {
                        return callback(err, response);
                    });
                }
            } else {
                return callback();
            }
        }
    ], callback);
}

function httpDelete(url, context, callback) {
    if (!callback && typeof (context) === 'function') {
        callback = context;
        context = defaultContextURL;
    }

    async.waterfall([
        (callback) => {
            request({
                url: url,
                method: "DELETE",
                json: true
            }, callback);
        },
        (response, body, callback) => {
            if (response.statusCode !== 200) {
                return callback(response.statusCode, body);
            } else if (body) {
                if (body.constructor === Array) {
                    return async.map(body, (resource, callback) => {
                        return jsonld.compact(resource, context, (err, response) => {
                            return callback(err, response);
                        });
                    }, callback);
                } else {
                    return jsonld.compact(body, context, (err, response) => {
                        return callback(err, response);
                    });
                }
            } else {
                return callback();
            }
        }
    ], callback);
}


var serviceRegistryServicesURL;

function setServiceRegistryServicesURL(servicesURL) {
    serviceRegistryServicesURL = servicesURL;
}

function getServiceRegistryServicesURL() {
    return serviceRegistryServicesURL;
}

function getServices(context, callback) {
    if (!serviceRegistryServicesURL) {
        callback("Service Registry Services URL not set");
    }

    httpGet(serviceRegistryServicesURL, context, callback);
}

function getResourceURLs(type, callback) {
    async.waterfall([
        (callback) => {
            getServices(internalContext, callback);
        },
        (services, callback) => {
            var resourceURLs = [];

            services.forEach(service => {
                var hasResources = (service.hasResource.constructor === Array) ? Array.from(service.hasResource) : Array.of(service.hasResource);

                hasResources.forEach(hasResource => {
                    if (hasResource.resourceType === type) {
                        resourceURLs.push(hasResource.httpEndpoint);
                    }
                });
            });

            callback(null, resourceURLs);
        }
    ], callback);
}

function getResource(object, context, callback) {
    var type = typeof object;

    if (type === "object") {
        if (object.id) {
            object = object.id;
            type = "string";
        }
    }

    switch (type) {
        case "string":
            var url = object;
            return httpGet(url, context, callback);
        case "object":
            if (object.constructor === Array) {
                if (object.length > 1) {
                    return callback("getResource() does not work with arrays with more than 1 element");
                } else {
                    return callback(null, object[0]);
                }
            } else {
                return callback(null, object);
            }
            break;
        default:
            return callback("Cannot dereference object with type '" + type + "'");
    }
}

function postResource(type, resource, callback) {
    async.waterfall([
        (callback) => {
            return getResourceURLs(type, callback);
        },
        (resourceURLs, callback) => {
            if (resourceURLs.length === 0) {
                return callback("No resource URL found for type '" + type + "'");
            }
            return httpPost(resourceURLs[0], resource, callback);
        }
    ], callback);
}

function isValidJob(job, callback) {
    async.waterfall([
        (callback) => {
            return jsonld.compact(job, minimalContext, (err, job) => {
                return callback(err, job);
            });
        },
        (job, callback) => {
            if (!job["fims:hasJobProfile"]) {
                return callback("Missing JobProfile");
            } else if (job["fims:hasJobProfile"].constructor === Array && job["fims:hasJobProfile"].length > 1) {
                return callback("Too many JobProfiles");
            } else {
                return getResource(job["fims:hasJobProfile"], minimalContext, (err, jobProfile) => callback(err, job, jobProfile));
            }
        },
        (job, jobProfile, callback) => {
            if (jobProfile.type !== "fims:JobProfile") {
                return callback("JobProfile has wrong type '" + jobProfile.type + "'");
            } else if (jobProfile["fims:hasInputParameter"]) {
                var inputParameters = (jobProfile["fims:hasInputParameter"].constructor === Array) ? Array.from(jobProfile["fims:hasInputParameter"]) : Array.of(jobProfile["fims:hasInputParameter"]);

                return async.each(inputParameters, (inputParameter, callback) => {
                    if (inputParameter.type !== "fims:JobParameter") {
                        return callback("Invalid JobProfile: inputParameter with wrong type '" + inputParameter.type + "' detected");
                    } else if (!inputParameter["fims:jobProperty"]) {
                        return callback("Invalid JobProfile: inputParameter without 'fims:jobProperty' detected");
                    } else if (!inputParameter["fims:jobProperty"].id) {
                        return callback("Invalid JobProfile: inputParameter with wrongly defined 'fims:jobProperty' detected");
                    } else {
                        var inputPropertyName = inputParameter["fims:jobProperty"].id;

                        if (!job["fims:hasJobInput"]) {
                            return callback("Invalid Job: Missing required property 'fims:hasJobInput'");
                        } else if (job["fims:hasJobInput"].constructor === Array) {
                            return callback("Invalid Job: Required property 'fims:hasJobInput' must not be an array");
                        } else if (!job["fims:hasJobInput"][inputPropertyName]) {
                            return callback("Invalid Job: Missing required input parameter '" + inputPropertyName + "'");
                        } else if (inputParameter["fims:jobParameterType"] && inputParameter["fims:jobParameterType"].id && job["fims:hasJobInput"][inputPropertyName].type !== inputParameter["fims:jobParameterType"].id) {
                            return callback("Invalid Job: Required input parameter '" + inputPropertyName + "' has wrong type");
                        } else {
                            return callback();
                        }
                    }
                }, callback);
            } else {
                return callback();
            }
        }
    ], callback)
}

function canServiceAcceptJob(service, job, callback) {
    async.waterfall([
        (callback) => {
            return jsonld.compact(service, minimalContext, (err, service) => {
                return callback(err, service);
            });
        },
        (service, callback) => {
            return jsonld.compact(job, minimalContext, (err, job) => {
                return callback(err, service, job);
            });
        },
        (service, job, callback) => {
            if (!service["fims:acceptsJobType"]) {
                return callback("Service does not accept JobType '" + job.type + "'");
            } else {
                var acceptedJobTypes = (service["fims:acceptsJobType"].constructor === Array) ? Array.from(service["fims:acceptsJobType"]) : Array.of(service["fims:acceptsJobType"]);

                var acceptsJobType = false;

                acceptedJobTypes.forEach(jobType => {
                    if (jobType.id === job.type) {
                        acceptsJobType = true;
                    }
                });

                if (!acceptsJobType) {
                    return callback("Service does not accept JobType '" + job.type + "'");
                } else {
                    if (!service["fims:acceptsJobProfile"]) {
                        return callback("Service does not accept Job with specified Job Profile");
                    } else {
                        var acceptedJobProfiles = service["fims:acceptsJobProfile"].constructor === Array ? Array.from(service["fims:acceptsJobProfile"]) : Array.of(service["fims:acceptsJobProfile"]);

                        var acceptsJobProfile = false;

                        acceptedJobProfiles.forEach(jobProfile => {
                            if (equal(jobProfile, job["fims:hasJobProfile"])) {
                                acceptsJobProfile = true;
                            }
                        });

                        if (!acceptsJobProfile) {
                            return callback("Service does not accept Job with specified Job Profile");
                        } else {
                            return callback(null);
                        }
                    }
                }
            }
        },
    ], callback);
}

function getJobProfilesByLabel(jobType, jobProfileLabel, callback) {
    var jobProfiles = [];

    async.waterfall([
        (callback) => {
            return getServices(internalContext, callback);
        },
        (services, callback) => {
            return async.each(services, (service, callback) => {
                if (service.acceptsJobType && service.acceptsJobProfile) {
                    var acceptedJobTypes = (service.acceptsJobType.constructor === Array) ? Array.from(service.acceptsJobType) : Array.of(service.acceptsJobType);

                    var acceptsJobType = false;

                    acceptedJobTypes.forEach(acceptedJobType => {
                        if (acceptedJobType === jobType) {
                            acceptsJobType = true;
                        }
                    });

                    if (acceptsJobType) {
                        var acceptedJobProfiles = (service.acceptsJobProfile.constructor === Array) ? Array.from(service.acceptsJobProfile) : Array.of(service.acceptsJobProfile);
                        return async.each(acceptedJobProfiles, (acceptedJobProfile, callback) => {
                            return async.waterfall([
                                (callback) => {
                                    return getResource(acceptedJobProfile, internalContext, callback);
                                },
                                (jobProfile, callback) => {
                                    if (jobProfile.label !== jobProfileLabel) {
                                        return callback();
                                    }

                                    if (!jobProfile["@context"]) {
                                        jobProfile["@context"] = internalContext;
                                    }

                                    return jsonld.compact(jobProfile, defaultContextURL, (err, jobProfile) => {
                                        if (err) {
                                            return callback(err);
                                        }
                                        jobProfiles.push(jobProfile);
                                        callback();
                                    });
                                }
                            ], callback);
                        }, callback);
                    }
                }

                return callback();
            }, callback);
        }
    ], (err) => {
        return callback(err, jobProfiles);
    });
}

module.exports = {
    getDefaultContext: getDefaultContext,
    getDefaultContextURL: getDefaultContextURL,
    setDefaultContextURL: setDefaultContextURL,
    getContextCacheExpirationTime: getContextCacheExpirationTime,
    setContextCacheExpirationTime: setContextCacheExpirationTime,
    getContext: getContext,
    putContext: putContext,
    removeContext: removeContext,
    compact: compact,
    expand: expand,
    flatten: flatten,
    frame: frame,
    normalize: normalize,
    toRDF: toRDF,
    fromRDF: fromRDF,
    Service: Service,
    ServiceResource: ServiceResource,
    JobProfile: JobProfile,
    JobParameter: JobParameter,
    JobParameterBag: JobParameterBag,
    Locator: Locator,
    AsyncEndpoint: AsyncEndpoint,
    AmeJob: AmeJob,
    CaptureJob: CaptureJob,
    QAJob: QAJob,
    TransferJob: TransferJob,
    TransformJob: TransformJob,
    JobProcess: JobProcess,
    JobAssignment: JobAssignment,
    httpGet: httpGet,
    httpPost: httpPost,
    httpPut: httpPut,
    httpDelete: httpDelete,
    getServiceRegistryServicesURL: getServiceRegistryServicesURL,
    setServiceRegistryServicesURL: setServiceRegistryServicesURL,
    getServices: getServices,
    getResourceURLs: getResourceURLs,
    postResource: postResource,
    isValidJob: isValidJob,
    canServiceAcceptJob: canServiceAcceptJob,
    getJobProfilesByLabel: getJobProfilesByLabel
}

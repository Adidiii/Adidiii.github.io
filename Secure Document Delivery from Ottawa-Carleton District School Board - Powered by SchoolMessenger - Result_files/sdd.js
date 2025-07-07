/**
 *
 * Secure Document Delivery (SDD) "class"
 *
 * This class is used to implement the attachment download page that a parent
 * would see after clicking on an attachment link in an email.  The attachment could be 
 * a PDF portion that was sent using the SDD feature, or a file that the commsuite user
 * attached to an email message.
 *
 * Requires specific DOM element(s) to be present prior to instantiation, i.e. calling 'new SDD()',
 * should be performed when the document is "ready"
 *
 * Upon instantiation, appropriate event handler(s) will be initialized to manage necessary view elements.
 *
 * Supports two (2) different SDD views: SDD Password and SDD Download
 *
 * @author Justin Burns <jburns@schoolmessenger.com>
 * @date Mar 1, 2013
 *
 * @constructor
 */
function SDD(contentType) {

	var $this = this;

	this.requestDocumentUrl = "requestdocument.php";
	this.getDocumentUrl = "getdocument.php";

	this.messageLinkCode = $("#message-link-code").val();
	this.attachmentLinkCode = $("#attachment-link-code").val();

	this.downloadErrorMsg = $("#download-error-message");
	
	this.secureErrorMsg = $("#secure-error-message");
	
	this.downloadStatusMessage = $("#download-status-message");

	// Containers to hide and show depending on success, failure, password, etc.
	this.secureHeadingContainer = $("#secure-heading-container");
	this.secureFormContainer = $("#secure-form-container");
	this.downloadInprogressContainer = $("#download-inprogress-container");
	this.downloadSuccessContainer = $("#download-success-container");
	this.downloadFailureContainer = $("#download-failure-container");
	this.downloadDirectLinkContainer = $("#download-direct-link-container");
	this.downloadErrorMsgContainer = $("#download-error-message-container");
	this.secureErrorMsgContainer = $("#secure-error-message-container");

	/**
	 *	Initializes appropriate event handler(s) depending on the resulting SDD page (Password or Download).
	 *
	 * If password elem exists, implies SDD Password page, therefore init SDD Password page-specifc event handlers,
	 * otherwise request document
	 */
	this.initialize = function() {
		this.password = $("#password");
		// enhancedDowload uses JaveScript to download 
		// the file, rather than built in browser support.
		// The downloadSuccessContainer html element will only exist in the 
		// case of enhancedDownload, so turn on enhancedDownlad if 
		// the element exists.
		this.enhancedDownload = this.downloadSuccessContainer;

		if ($this.password.length) {
			$this.downloadB  = $("#downloadB");
			$this.addPasswordInputHandler();
			$this.addDownloadBtnClickHandler();
			$this.addDirectLinkClickHandler($this.promptPassword);
			$this.promptPassword();
		} else {
			$this.addDirectLinkClickHandler($this.requestDocument);
			$this.requestDocument();
		}
	}
	
	this.promptPassword = function () {
		$("#password").val("") // Clear password in case the user has clicked the direct link to retry
		$this.showContainers([$this.secureHeadingContainer, $this.secureFormContainer])
	}

	/**
	 *
	 * @param string password user-entered password value from input[type=text] elem
	 * @return {*}
	 */
	this.requestDocument = function (password) {
		var requestParams = {
			"s": $this.messageLinkCode,
			"mal": $this.attachmentLinkCode,
			"p": password ? password : null
		};
		// if password provided, include v ("verify") param to verify password server-side,
		if (password) {
			requestParams['v'] = true;
			return $.ajax({
				url: this.requestDocumentUrl,
				type: "POST",
				data: requestParams,
				success: function (res) {
					// ensure the verify 'v' param is removed from requestParams, i.e. was successful
					delete requestParams['v'];
					// now download the document
					$this.download(requestParams);
				},
				error: function (res) {
					if (res && res.responseJSON && res.responseJSON.errorMessage) {
						$this.secureErrorMsg.html(res.responseJSON.errorMessage);
					} else {
						$this.secureErrorMsg.html("An error occurred while trying to retrieve your document. Please try again.");
					}
					$this.toggleShowContainer($this.secureErrorMsgContainer, true);
				}
			});
		} else {
			// now download the document
			$this.download(requestParams);
		}

	};
	
	this.download = function(requestParams) {
		if ($this.enhancedDownload) {
			// download using code
			$this.downloadAndSave(requestParams);
		} else {
			// redirect user to direct URL,
			// which should invoke the browser's download/save as dialog
			$this.postToUrl(requestParams);
		}
	}

	/**
	 *
	 * Builds and submits form dynamically via jQuery. Upon submit, removes form from DOM.
	 *
	 * borrowed/modified from http://stackoverflow.com/questions/133925/javascript-post-request-like-a-form-submit
	 *
	 * @param params
	 */
	this.postToUrl = function(params) {
		return; // TESTING
		var form = $this.getDocumentForm(params);

		// the form must be in the document to submit
		$("body").append(form);
		form.submit();

		// clean up/remove the form from the DOM now that we've submitted
		form.remove();
	}

	/**
	 *
	 * Downloads an attachment as a blob, then writes the blob to a file.
	 * Updates the page to provide user feedback as the attachment is retrieved.
	 *
	 * @param params
	 */
	this.downloadAndSave = function (params) {
		// Create a form to hold the information needed to make the ajax request.
		// The form will not be submitted.
		var form = $this.getDocumentForm(params);
		var page_url = form.attr('action'); 
		var method = form.attr('method').toUpperCase();
		var params = form.serialize();  // params look something like s=Ek2RJtAUw-U&mal=a4eccc06d5dec598b6873f688bbbe4eaca351dd780d31013332ba6595a89b244&p=
		
		const FINISHED = 4
		const MIN_PROGRESS = 2 * 1000  // Show progress indicators for at least 2 seconds
		const TRANSFERRING = "Downloading document"
		const PREPARING = "Preparing document"

		if (method === 'GET') {
			// For GET, add query params
			page_url += '?' + params;
		}
		
		// XMLHttpRequest can request a blob so use instead of jquery ajax
		var req = new XMLHttpRequest();
		req.open(method, page_url, true);
		req.responseType = "blob";
		if (method === 'POST') {
			// For POST, pass body params
			req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
		}
		req.addEventListener("progress", function (evt) {
			// Some data has been transferred, let the user know
			$this.showDownloadingStatus(TRANSFERRING);
		}, false);
		req.onreadystatechange = function () {
			if (req.readyState === FINISHED && req.status >= 200 && req.status < 300) {
				// We have the blob so save to a file and change messaging on the page
				var filename = $this.getContentDispositionFilename(req);
				setTimeout(function () {
					try {
						$this.saveBlob(req.response, filename);
						$this.showDownloadSuccess();
					} catch(error) {
						console.log("Unexpected save blob error: " + error);
						$this.showDownloadFailure(error);
					}
				}, MIN_PROGRESS); // Introduce a delay so that the progress indicator is visible for at least a few seconds
			} else if (req.readyState === FINISHED) {
				var status, statusText;
				try {
					status = req.status;
					statusText = req.statusText;
				} catch (e) {
					status = 0;
					statusText = "Unknown";
				}
				console.log("download HTTP error: " + status + " " + statusText);
				$this.showDownloadFailure($this.formatUnexpectedHttpError(status))
			}
		}

		req.onerror = function () {
			// Network error
			console.log("network error accessing " + method + " " + page_url);
			$this.showDownloadFailure($this.formatUnexpectedError("network"));
		}

		req.ontimeout = function () {
			// XMLHttpRequest timed out. 
			console.log("timeout accessing " + method + " " + page_url);
			$this.showDownloadFailure($this.formatUnexpectedError("client timeout"));
		}

		// Provide user feedback that a file is being retrieved
		$this.showDownloadingStatus(PREPARING);
		setTimeout(function () {
			// For POST, pass body params
			try {
				req.send(method === 'POST' && params);
			} catch(error) {
				console.log("Send error: " + JSON.stringify(error));
				$this.showDownloadFailure($this.formatUnexpectedError("communication"));
			}
		}, MIN_PROGRESS); // Introduce a delay so that the progress indicator is visible for at least a few seconds
	}

	this.formatUnexpectedHttpError = function(status) {
		if (status === 504) {
			errorType = "server timeout"
		} else if (status >= 500) {
			errorType = "server"
		} else if (status >= 400) {
			errorType = "client"
		} else {
			errorType = "http"
		}
		return $this.formatUnexpectedError(errorType);
	}

	this.formatUnexpectedError = function(errorType) {
		if (errorType) {
			errorType += " "
		}
		return "An unexpected " + errorType + "error occurred when requesting your document"
	}
	
	this.showDownloadingStatus = function(status) {
		$this.downloadStatusMessage.html(status);
		$this.showContainers([$this.downloadInprogressContainer]);
	}

	this.showDownloadSuccess = function() {
		$this.showContainers([$this.downloadSuccessContainer, $this.downloadDirectLinkContainer]);
	}
	
	this.showDownloadFailure = function(message) {
		if (message) {
			$this.downloadErrorMsg.html(message)
		} else {
			$this.downloadErrorMsg.html("An error occurred while trying to retrieve your document. Please try again.");
		}
		$this.showContainers([
			$this.downloadFailureContainer, 
			$this.downloadDirectLinkContainer,
			$this.downloadErrorMsgContainer]);
	}

	this.showContainers = function(showContainers) {
		var allContainers = [$this.downloadInprogressContainer, 
			$this.downloadSuccessContainer, 
			$this.downloadFailureContainer, 
			$this.downloadDirectLinkContainer,
			$this.secureHeadingContainer,
			$this.secureFormContainer,
			$this.downloadErrorMsgContainer,
			$this.secureErrorMsgContainer]
		for (let i = 0; i < allContainers.length; i++) {
			var container = allContainers[i]
			if (container) {
				var show = showContainers.some(s => s === container);
				$this.toggleShowContainer(container, show);
				//container.toggleClass('hidden', hidden)
			}
		}
	}

	this.toggleShowContainer = function(container, show) {
		container.toggleClass('hidden', !show)
	}

	// The content disposition header will look something like this: attachment; filename="attachment.pdf"
	this.getContentDispositionFilename = function(req) {
		var filename = req.getResponseHeader('Content-Disposition');
		filename = filename && filename.includes("filename=") ? filename.split("filename=")[1] : "attachment"
		if (filename.charAt(0) === '"' && filename.charAt(filename.length - 1) === '"') {
			return filename.substr(1,filename.length - 2)
		}
		return filename;
	}

	this.saveBlob = function(response, filename) {
		var blob = new Blob([response], { type: contentType });

		if (typeof window.navigator.msSaveBlob !== 'undefined') {
			// IE workaround for HTML7007
			// window.navigator.msSaveBlob(blob, filename);
			throw("This browser version is not supported.  Please try again with a different browser.")
		} else {
			var URL = window.URL || window.webkitURL;
			var downloadUrl = URL.createObjectURL(blob);
			var a = document.createElement("a");

			// safari doesn't support this yet
			if (typeof a.download === 'undefined') {
				window.location = downloadUrl;
			} else {
				// use HTML5 a[download] attribute to specify filename
				a.href = downloadUrl;
				a.download = filename;
				document.body.appendChild(a);
				a.target = "_blank";
				a.click();
			}
		}
	}

	/**
	 *
	 * @param object params - object containing all the required post params, ex. s, mal, p, v.
	 * @return jQuery object representing the form, contains child hidden input elements
	 */
	this.getDocumentForm = function(params) {
		var form, action, method;

		// If a password is present we don't want to show it in the url bar, so we use
		// a POST request.
		// FIXME: This will fail on mobile browser when trying to download
		// and play an audio or video file, because the resource will be re-requested
		// with a GET request without the necessary params.
		if (params['p']) {
			action = this.requestDocumentUrl;
			method = 'post';
		} else {
			action = this.getDocumentUrl;
			method = 'get'
		}

		form = $("<form>").attr({method: method, action: action});

		// append hidden elements to the form, based on params object
		for(var key in params) {
			if(params.hasOwnProperty(key)) {
				var hiddenField = $("<input>");
				hiddenField.attr({type: "hidden", name: key, value: params[key]});
				form.append(hiddenField);
			}
		}

		return form;
	}

	/**
	 *
	 * @return {*}
	 */
	this.getPassword = function() {
		return $this.password ? $.trim($this.password.val()) : null;
	};

	/**
	 *
	 * @param elem
	 */
	this.disableElem = function(elem) {
		if (elem) {
			elem.attr('disabled', 'disabled').addClass('disabled');
		}
	};

	/**
	 *
	 * @param elem
	 */
	this.enableElem = function(elem) {
		if (elem) {
			elem.removeAttr('disabled').removeClass('disabled');
		}
	};

	/**
	 *
	 */
	this.addPasswordInputHandler = function() {
		if ($this.password) {
			$this.password.on("keyup", function(e) {
				var pwdVal = $this.getPassword();

				if (pwdVal.length > 0) {
					$this.enableElem($this.downloadB);
				} else {
					$this.disableElem($this.downloadB);
				}

				if (e.which !== 13) {
					$this.toggleShowContainer($this.secureErrorMsgContainer, false);
				}
			});

			$this.password.on("keydown", function(e) {
				var pwdVal = $this.getPassword();

				if (pwdVal.length > 0) {
					if (e.which === 13) {
						$this.requestDocument($this.getPassword());
						return false;
					}
				} else {
					if (e.which === 13) {
						return false;
					}
				}
			});
		}
	};

	/**
	 *
	 */
	this.addDownloadBtnClickHandler = function() {
		if ($this.downloadB) {
			$this.downloadB.on('click', function(e) {
				e.preventDefault();
				$this.requestDocument($this.getPassword());
			});
		}
	}

	/**
	 *
	 */
	this.addDirectLinkClickHandler = function(fn) {
		var directLink = $(".directlink");
		if (directLink) {
			directLink.on('click', function(e) {
				e.preventDefault();
				fn();
			});
		}
	};
}

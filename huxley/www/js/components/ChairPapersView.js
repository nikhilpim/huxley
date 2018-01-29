/**
 * Copyright (c) 2011-2017 Berkeley Model United Nations. All rights reserved.
 * Use of this source code is governed by a BSD License (see LICENSE).
 +*/

'use strict';

var React = require('react');
var ReactRouter = require('react-router');

var Button = require('components/core/Button');
var AssignmentStore = require('stores/AssignmentStore');
var CommitteeStore = require('stores/CommitteeStore');
var CountryStore = require('stores/CountryStore');
var CurrentUserStore = require('stores/CurrentUserStore');
var InnerView = require('components/InnerView');
var PaperAssignmentList = require('components/PaperAssignmentList');
var PaperGradeTable = require('components/PaperGradeTable');
var PositionPaperActions = require('actions/PositionPaperActions');
var PositionPaperStore = require('stores/PositionPaperStore');
var TextTemplate = require('components/core/TextTemplate');
var User = require('utils/User');

var ServerAPI = require('lib/ServerAPI');

require('css/Table.less');
var ChairPapersViewText = require('text/ChairPapersViewText.md');

var ChairPapersView = React.createClass({
  mixins: [ReactRouter.History],

  getInitialState() {
    var user = CurrentUserStore.getCurrentUser();
    var assignments = AssignmentStore.getCommitteeAssignments(user.committee);
    var countries = CountryStore.getCountries();
    var committees = CommitteeStore.getCommittees();
    var papers = PositionPaperStore.getPapers();
    if (assignments.length) {
      PositionPaperStore.getPositionPaperFile(
        assignments[0].paper.id,
        assignments[0].paper.file,
      );
    }
    var files = PositionPaperStore.getPositionPaperFiles();

    if (assignments.length && Object.keys(countries).length) {
      assignments.sort(
        (a1, a2) =>
          countries[a1.country].name < countries[a2.country].name ? -1 : 1,
      );
    }

    return {
      loading: false,
      success: false,
      assignments: assignments,
      committees: committees,
      countries: countries,
      papers: papers,
      current_assignment: null,
      uploadedFile: null,
      files: files,
      errors: {},
    };
  },

  componentWillMount() {
    var user = CurrentUserStore.getCurrentUser();
    if (!User.isChair(user)) {
      this.history.pushState(null, '/');
    }
  },

  componentDidMount() {
    var user = CurrentUserStore.getCurrentUser();

    this._assignmentsToken = AssignmentStore.addListener(() => {
      var assignments = AssignmentStore.getCommitteeAssignments(user.committee);
      var countries = this.state.countries;
      PositionPaperStore.getPositionPaperFile(
        assignments[0].paper.id,
        assignments[0].paper.file,
      );
      if (Object.keys(countries).length) {
        assignments.sort(
          (a1, a2) =>
            countries[a1.country].name < countries[a2.country].name ? -1 : 1,
        );
      }

      this.setState({
        assignments: assignments,
      });
    });

    this._countriesToken = CountryStore.addListener(() => {
      var assignments = this.state.assignments;
      var countries = CountryStore.getCountries();
      if (assignments.length) {
        assignments.sort(
          (a1, a2) =>
            countries[a1.country].name < countries[a2.country].name ? -1 : 1,
        );
      }
      this.setState({
        assignments: assignments,
        countries: countries,
      });
    });

    this._committeesToken = CommitteeStore.addListener(() => {
      this.setState({committees: CommitteeStore.getCommittees()});
    });

    this._papersToken = PositionPaperStore.addListener(() => {
      this.setState({files: PositionPaperStore.getPositionPaperFiles()});
    });
  },

  componentWillUnmount() {
    this._countriesToken && this._countriesToken.remove();
    this._committeesToken && this._committeesToken.remove();
    this._assignmentsToken && this._assignmentsToken.remove();
    this._papersToken && this._papersToken.remove();
    this._successTimeout && clearTimeout(this._successTimeout);
  },

  render() {
    if (this.state.current_assignment == null) {
      return (
        <InnerView>
          <TextTemplate>{ChairPapersViewText}</TextTemplate>
          <form>
            <div className="table-container">{this.renderAssignmentList()}</div>
          </form>
        </InnerView>
      );
    } else {
      return (
        <InnerView>
          <form>
            <div className="table-container">{this.renderRubric()}</div>
          </form>
        </InnerView>
      );
    }
  },

  renderRubric() {
    var user = CurrentUserStore.getCurrentUser();
    var paper = this.state.papers[this.state.current_assignment.paper.id];
    var country = this.state.countries[this.state.current_assignment.country];
    var files = this.state.files;
    var rubric = Object.keys(this.state.committees).length
      ? this.state.committees[user.committee].rubric
      : null;

    if (rubric != null && paper != null) {
      return (
        <PaperGradeTable
          rubric={rubric}
          paper={paper}
          files={files}
          countryName={country.name}
          onChange={this._handleScoreChange}
          onDownload={this._handleDownload}
          onUnset={this._handleUnsetAssignment}
          onSave={this._handleSavePaper}
          onUpload={this._handleUploadPaper}
          onSubmit={this._handleSubmitPaper}
          loading={this.state.loading}
          success={this.state.success}
        />
      );
    } else {
      return <div />;
    }
  },

  renderAssignmentList() {
    var assignments = this.state.assignments;
    var countries = this.state.countries;

    if (Object.keys(countries).length) {
      return (
        <PaperAssignmentList
          assignments={assignments}
          countries={countries}
          onChange={this._handleAssignmentSelect}
        />
      );
    } else {
      return <div />;
    }
  },

  _handleScoreChange(field, paperID, event) {
    var paper = {...this.state.papers[paperID], [field]: Number(event)};
    PositionPaperActions.storePositionPaper(paper);
  },

  _handleUnsetAssignment(event) {
    this.setState({
      current_assignment: null,
      uploadedFile: null,
    });
  },

  _handleAssignmentSelect(assignmentID, event) {
    var assignments = this.state.assignments;
    var a = assignments.find(a => a.id == assignmentID);
    this.setState({current_assignment: a});
    PositionPaperActions.fetchPositionPaperFile(a.paper.id);
  },

  _handleUploadPaper(paperID, event) {
    this.setState({uploadedFile: event.target.files[0]});
  },

  _handleSubmitPaper(paperID, event) {
    var file = this.state.uploadedFile;
    if (
      file != null &&
      window.confirm(
        `Please make sure this is the file you intend to submit! You have uploaded: ${
          file.name
        }.`,
      )
    ) {
      var files = this.state.files;
      var paper = {...this.state.papers[paperID]};
      paper.file = file.name;

      PositionPaperActions.uploadPaper(
        paper,
        file,
        this._handleSuccess,
        this._handleError,
      );
      PositionPaperActions.storePositionPaper(paper);

      this.setState({
        loading: true,
        uploadedFile: null,
        current_assignment: null,
      });
    }
  },

  _handleSavePaper(paperID, event) {
    this.setState({loading: true});
    this._successTimout && clearTimeout(this._successTimeout);
    var committee = CurrentUserStore.getCurrentUser().committee;
    var paper = {...this.state.papers[paperID]};
    delete paper['file'];
    paper['graded'] = true;
    PositionPaperActions.updatePositionPaper(
      paper,
      this._handleSuccess,
      this._handleError,
    );
    event.preventDefault();
    this._handleSubmitPaper(paperID, event);
  },

  _handleSuccess: function(response) {
    this.setState({
      loading: false,
      success: true,
    });

    this._successTimeout = setTimeout(
      () => this.setState({success: false}),
      2000,
    );
  },

  _handleError: function(response) {
    this.setState({loading: false});
    window.alert(
      'Something went wrong. Please refresh your page and try again.',
    );
  },
});

module.exports = ChairPapersView;
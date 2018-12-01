import React, { Component } from 'react';
import { connect } from 'react-redux';
import './ArtigoDiscussion.css';
import { checkDarkModeBackground } from '../../utils/CheckDarkMode.js';
import LatestNewsSingleContainer from '../latestNewsSingleContainer.js';

class ArtigoDiscussion extends Component {
  render() {
    return (
      <LatestNewsSingleContainer article={this.props.article} />
    );
  }
}

function mapStateToProps(state) {
  return {
    darkMode: state.view.darkMode
  };
}

function mapDispatchToProps(dispatch) {
  return { };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ArtigoDiscussion);

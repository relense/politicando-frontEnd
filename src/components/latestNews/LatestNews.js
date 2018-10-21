import React, { Component } from 'react';
import { connect } from 'react-redux';
import './LatestNews.css';
import LatestNewsSingleContainer from './LatestNewsSingleContainer';

class LatestNews extends Component {
  render() {
    return (
      <div className="latestNewsMainContainer">
        <h3>Latest Information</h3>

        <div className="latestNewsDoubleContainer">
          <LatestNewsSingleContainer />
          <LatestNewsSingleContainer />
        </div>

        <div className="latestNewsDoubleContainer">
          <LatestNewsSingleContainer />
          <LatestNewsSingleContainer />
        </div>

        <div className="latestNewsDoubleContainer">
          <LatestNewsSingleContainer />
          <LatestNewsSingleContainer />
        </div>

        <div className="latestNewsDoubleContainer">
          <LatestNewsSingleContainer />
          <LatestNewsSingleContainer />
        </div>
        
      </div>
    );
  }
}

function mapStateToProps(state) {
  return { };
}

function mapDispatchToProps(dispatch) {
  return { };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LatestNews);

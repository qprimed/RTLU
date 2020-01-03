import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';

import { Subject } from 'rxjs';
import { takeUntil, filter, take } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { Actions } from '@ngrx/effects';
import { faUsers } from '@fortawesome/free-solid-svg-icons';

import { MatTableDataSource, MatSort, MatPaginator, MatPaginatorIntl } from '@angular/material';
import { PeerCL, GetInfoCL } from '../../../shared/models/clModels';
import { PAGE_SIZE, PAGE_SIZE_OPTIONS, getPaginatorLabel, AlertTypeEnum, DataTypeEnum, ScreenSizeEnum } from '../../../shared/services/consts-enums-functions';
import { LoggerService } from '../../../shared/services/logger.service';
import { CommonService } from '../../../shared/services/common.service';
import { OpenChannelComponent } from '../../../shared/components/data-modal/open-channel/open-channel.component';
import { newlyAddedRowAnimation } from '../../../shared/animation/row-animation';
import { CLEffects } from '../../store/cl.effects';
import { RTLEffects } from '../../../store/rtl.effects';
import * as RTLActions from '../../../store/rtl.actions';
import * as fromRTLReducer from '../../../store/rtl.reducers';

@Component({
  selector: 'rtl-cl-peers',
  templateUrl: './peers.component.html',
  styleUrls: ['./peers.component.scss'],
  animations: [newlyAddedRowAnimation],
  providers: [
    { provide: MatPaginatorIntl, useValue: getPaginatorLabel('Peers') },
  ]
})
export class CLPeersComponent implements OnInit, OnDestroy {
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  public faUsers = faUsers;
  public newlyAddedPeer = '';
  public flgAnimate = true;
  public displayedColumns = [];
  public peerAddress = '';
  public peers: any;
  public information: GetInfoCL = {};
  public availableBalance = 0;
  public flgLoading: Array<Boolean | 'error'> = [true]; // 0: peers
  public flgSticky = false;
  public pageSize = PAGE_SIZE;
  public pageSizeOptions = PAGE_SIZE_OPTIONS;
  public screenSize = '';
  public screenSizeEnum = ScreenSizeEnum;
  private unSubs: Array<Subject<void>> = [new Subject(), new Subject(), new Subject(), new Subject()];

  constructor(private logger: LoggerService, private store: Store<fromRTLReducer.RTLState>, private rtlEffects: RTLEffects, private clEffects: CLEffects, private actions$: Actions, private commonService: CommonService) {
    this.screenSize = this.commonService.getScreenSize();
    if(this.screenSize === ScreenSizeEnum.XS) {
      this.flgSticky = false;
      this.displayedColumns = [ 'alias', 'actions'];
    } else if(this.screenSize === ScreenSizeEnum.SM) {
      this.flgSticky = false;
      this.displayedColumns = [ 'alias', 'sat_sent', 'sat_recv', 'actions'];
    } else if(this.screenSize === ScreenSizeEnum.MD) {
      this.flgSticky = false;
      this.displayedColumns = ['alias', 'sat_sent', 'sat_recv', 'ping_time', 'actions'];
    } else {
      this.flgSticky = true;
      this.displayedColumns = ['alias', 'pub_key', 'sat_sent', 'sat_recv', 'ping_time', 'actions'];
    }
  }

  ngOnInit() {
    this.store.select('cl')
    .pipe(takeUntil(this.unSubs[0]))
    .subscribe((rtlStore) => {
      rtlStore.effectErrorsCl.forEach(effectsErr => {
        if (effectsErr.action === 'FetchPeersCL') {
          this.flgLoading[0] = 'error';
        }
      });
      this.information = rtlStore.information;
      this.availableBalance = rtlStore.balance.totalBalance || 0;
      this.peers = new MatTableDataSource([]);
      this.peers.data = [];
      if (undefined !== rtlStore.peers) {
        this.peers = new MatTableDataSource<PeerCL>([...rtlStore.peers]);
        this.peers.data = rtlStore.peers;
        setTimeout(() => { this.flgAnimate = false; }, 3000);
      }
      this.peers.sort = this.sort;
      this.peers.paginator = this.paginator;
      if (this.flgLoading[0] !== 'error') {
        this.flgLoading[0] = false;
      }
      this.logger.info(rtlStore);
    });
    this.actions$
    .pipe(
      takeUntil(this.unSubs[1]),
      filter((action) => action.type === RTLActions.SET_PEERS_CL)
    ).subscribe((setPeers: RTLActions.SetPeersCL) => {
      this.peerAddress = undefined;
      this.flgAnimate = true;
    });
  }

  onConnectPeer() {
    this.flgAnimate = true;
    this.newlyAddedPeer = this.peerAddress;
    this.store.dispatch(new RTLActions.OpenSpinner('Adding Peer...'));
    this.store.dispatch(new RTLActions.SaveNewPeerCL({id: this.peerAddress}));
  }

  onPeerClick(selPeer: PeerCL, event: any) {
    const reorderedPeer = [
      [{key: 'id', value: selPeer.id, title: 'Public Key', width: 100}],
      [{key: 'netaddr', value: selPeer.netaddr, title: 'Address', width: 100}],
      [{key: 'alias', value: selPeer.alias, title: 'Alias', width: 50}, {key: 'connected', value: selPeer.connected ? 'True' : 'False', title: 'Connected', width: 50}],
      [{key: 'globalfeatures', value: selPeer.globalfeatures, title: 'Global Features', width: 100}],
      [{key: 'localfeatures', value: selPeer.localfeatures, title: 'Local Features', width: 100}]
    ];
    this.store.dispatch(new RTLActions.OpenAlert({ data: {
      type: AlertTypeEnum.INFORMATION,
      alertTitle: 'Peer Information',
      showQRName: 'Public Key',
      showQRField: selPeer.id,
      message: reorderedPeer
    }}));
  }

  resetData() {
    this.peerAddress = '';
  }

  onOpenChannel(peerToAddChannel: PeerCL) {
    const peerToAddChannelMessage = {
      peer: peerToAddChannel, 
      information: this.information,
      balance: this.availableBalance
    };
    this.store.dispatch(new RTLActions.OpenAlert({ data: { 
      alertTitle: 'Open Channel',
      message: peerToAddChannelMessage,
      newlyAdded: false,
      component: OpenChannelComponent
    }}));
  }

  onPeerDetach(peerToDetach: PeerCL) {
    const msg = 'Disconnect peer: ' + ((peerToDetach.alias) ? peerToDetach.alias : peerToDetach.id);
    this.store.dispatch(new RTLActions.OpenConfirmation({ data: {
      type: AlertTypeEnum.CONFIRM,
      alertTitle: 'Disconnect Peer',
      titleMessage: msg,
      noBtnText: 'Cancel',
      yesBtnText: 'Disconnect'
    }}));
    this.rtlEffects.closeConfirm
    .pipe(takeUntil(this.unSubs[3]))
    .subscribe(confirmRes => {
      if (confirmRes) {
        this.store.dispatch(new RTLActions.OpenSpinner('Disconnecting Peer...'));
        this.store.dispatch(new RTLActions.DetachPeerCL({id: peerToDetach.id, force: false}));
      }
    });
  }

  applyFilter(selFilter: string) {
    this.peers.filter = selFilter;
  }

  ngOnDestroy() {
    this.unSubs.forEach(completeSub => {
      completeSub.next();
      completeSub.complete();
    });
  }
}

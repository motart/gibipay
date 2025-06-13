import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { ConsoleLogger } from 'aws-amplify/utils';
import { Table, TableHead, TableRow, TableCell, TableBody, View, Heading, Flex, TextField, SelectField } from '@aws-amplify/ui-react';
import { getItems as GetItems, getAccounts as GetAccounts, getTransactions as GetTransactions } from '../graphql/queries';
import Currency from '../components/Currency';

const logger = new ConsoleLogger('AllTransactions');

export default function AllTransactions() {
  const client = generateClient();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState({});

  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const itemsRes = await client.graphql({ query: GetItems });
        const items = itemsRes.data.getItems.items || [];
        let allTx = [];
        let accMap = {};
        for (const item of items) {
          try {
            const accRes = await client.graphql({ query: GetAccounts, variables: { id: item.item_id } });
            accRes.data.getAccounts.forEach(a => { accMap[a.account_id] = a; });
          } catch (err) {
            logger.error('unable to load accounts', err);
          }
          try {
            const txRes = await client.graphql({ query: GetTransactions, variables: { id: item.item_id, limit: 100 } });
            allTx = [...allTx, ...txRes.data.getTransactions.transactions];
          } catch (err) {
            logger.error('unable to load transactions', err);
          }
        }
        allTx.sort((a, b) => new Date(b.date) - new Date(a.date));
        setAccounts(accMap);
        setTransactions(allTx);
      } catch (err) {
        logger.error('unable to load items', err);
      }
    };
    load();
  }, []);

  const filtered = transactions.filter(tx => {
    if (search && !tx.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (accountFilter && tx.account_id !== accountFilter) return false;
    if (startDate && new Date(tx.date) < new Date(startDate)) return false;
    if (endDate && new Date(tx.date) > new Date(endDate)) return false;
    if (categoryFilter && !(tx.personal_finance_category?.primary || '').toLowerCase().includes(categoryFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <View>
      <Heading level={4}>All Transactions</Heading>
      <Flex direction="row" wrap="wrap">
        <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <TextField label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <TextField label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <SelectField label="Account" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
          <option value="">All Accounts</option>
          {Object.values(accounts).map(acc => (
            <option key={acc.account_id} value={acc.account_id}>{acc.name}</option>
          ))}
        </SelectField>
        <TextField label="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} />
      </Flex>
      <Table highlightOnHover variation="striped">
        <TableHead>
          <TableRow>
            <TableCell as="th">Name</TableCell>
            <TableCell as="th">Merchant</TableCell>
            <TableCell as="th">Amount</TableCell>
            <TableCell as="th">Date</TableCell>
            <TableCell as="th">Account</TableCell>
            <TableCell as="th">Category</TableCell>
            <TableCell as="th">Payment Channel</TableCell>
            <TableCell as="th">Transaction Type</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map(tx => (
            <TableRow key={tx.transaction_id}>
              <TableCell>{tx.name}</TableCell>
              <TableCell>{tx.merchant_name || '-'}</TableCell>
              <TableCell><Currency amount={tx.amount} currency={tx.iso_currency_code} /></TableCell>
              <TableCell>{tx.date}</TableCell>
              <TableCell>{accounts[tx.account_id]?.name || tx.account_id}</TableCell>
              <TableCell>{tx.personal_finance_category?.primary || '-'}</TableCell>
              <TableCell>{tx.payment_channel}</TableCell>
              <TableCell>{tx.transaction_type}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </View>
  );
}
